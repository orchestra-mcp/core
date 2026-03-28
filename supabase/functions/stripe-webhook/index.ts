import { createClient } from 'jsr:@supabase/supabase-js@2'
import { ApplicationError } from '../common/errors.ts'

/**
 * Plan limits mapping — values of -1 mean unlimited.
 */
const PLAN_LIMITS: Record<string, Record<string, number>> = {
  free: {
    max_users: 1,
    max_projects: 1,
    max_tokens: 2,
    max_agents: 3,
    max_tasks_per_month: 100,
    max_memory_mb: 50,
  },
  pro: {
    max_users: 5,
    max_projects: 10,
    max_tokens: 10,
    max_agents: 20,
    max_tasks_per_month: 2000,
    max_memory_mb: 500,
  },
  team: {
    max_users: 25,
    max_projects: -1,
    max_tokens: 50,
    max_agents: 100,
    max_tasks_per_month: 10000,
    max_memory_mb: 5120,
  },
  enterprise: {
    max_users: -1,
    max_projects: -1,
    max_tokens: -1,
    max_agents: -1,
    max_tasks_per_month: -1,
    max_memory_mb: -1,
  },
}

const encoder = new TextEncoder()

/**
 * Constant-time comparison to prevent timing attacks on signature verification.
 */
async function verifyStripeSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const parts = signature.split(',')
  const timestampPart = parts.find((p) => p.startsWith('t='))
  const signaturePart = parts.find((p) => p.startsWith('v1='))

  if (!timestampPart || !signaturePart) {
    return false
  }

  const timestamp = timestampPart.slice(2)
  const expectedSig = signaturePart.slice(3)

  // Reject events older than 5 minutes to prevent replay attacks
  const currentTime = Math.floor(Date.now() / 1000)
  if (currentTime - parseInt(timestamp) > 300) {
    return false
  }

  const signedPayload = `${timestamp}.${payload}`
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )
  const mac = await crypto.subtle.sign('HMAC', key, encoder.encode(signedPayload))
  const computedSig = Array.from(new Uint8Array(mac))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')

  // Constant-time comparison
  if (computedSig.length !== expectedSig.length) {
    return false
  }
  let mismatch = 0
  for (let i = 0; i < computedSig.length; i++) {
    mismatch |= computedSig.charCodeAt(i) ^ expectedSig.charCodeAt(i)
  }
  return mismatch === 0
}

/**
 * Look up an organization by its Stripe customer ID.
 */
async function getOrgByCustomerId(
  supabase: ReturnType<typeof createClient>,
  customerId: string
) {
  const { data, error } = await supabase
    .from('organizations')
    .select('id, name, plan')
    .eq('stripe_customer_id', customerId)
    .single()

  if (error || !data) {
    throw new ApplicationError(`Organization not found for Stripe customer: ${customerId}`, {
      customerId,
      error,
    })
  }
  return data
}

/**
 * Update an organization's plan, limits, and Stripe metadata.
 */
async function updateOrgPlan(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  plan: string,
  subscriptionId: string | null
) {
  const limits = PLAN_LIMITS[plan]
  if (!limits) {
    throw new ApplicationError(`Unknown plan: ${plan}`, { plan })
  }

  const { error } = await supabase
    .from('organizations')
    .update({
      plan,
      limits,
      stripe_subscription_id: subscriptionId,
    })
    .eq('id', orgId)

  if (error) {
    throw new ApplicationError('Failed to update organization plan', { orgId, plan, error })
  }
}

/**
 * Log an activity entry for billing events.
 */
async function logBillingEvent(
  supabase: ReturnType<typeof createClient>,
  orgId: string,
  action: string,
  summary: string,
  details: Record<string, unknown> = {}
) {
  await supabase.from('activity_log').insert({
    organization_id: orgId,
    action,
    summary,
    details,
  })
}

/**
 * Map Stripe price/product metadata to an Orchestra plan name.
 * Expects the Stripe Product or Price to include metadata.plan = 'free' | 'pro' | 'team' | 'enterprise'.
 */
function extractPlanFromSubscription(subscription: Record<string, unknown>): string {
  const items = subscription.items as { data?: Array<{ price?: { metadata?: { plan?: string } } }> }
  const plan = items?.data?.[0]?.price?.metadata?.plan
  return plan && plan in PLAN_LIMITS ? plan : 'free'
}

Deno.serve(async (req) => {
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const stripeWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')
  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

  if (!stripeWebhookSecret || !supabaseUrl || !supabaseServiceKey) {
    console.error('Missing required environment variables')
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const signature = req.headers.get('stripe-signature')
  if (!signature) {
    return new Response(JSON.stringify({ error: 'Missing stripe-signature header' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await req.text()

  // Verify the webhook signature
  const isValid = await verifyStripeSignature(body, signature, stripeWebhookSecret)
  if (!isValid) {
    console.error('Invalid Stripe webhook signature')
    return new Response(JSON.stringify({ error: 'Invalid signature' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const event = JSON.parse(body)
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object
        const customerId = session.customer as string
        const subscriptionId = session.subscription as string

        const org = await getOrgByCustomerId(supabase, customerId)

        // Retrieve the subscription to determine the plan
        // The plan is embedded in product/price metadata
        const plan = session.metadata?.plan || 'pro'

        await updateOrgPlan(supabase, org.id, plan, subscriptionId)
        await logBillingEvent(supabase, org.id, 'plan_upgraded', `Organization upgraded to ${plan} plan`, {
          event_type: event.type,
          previous_plan: org.plan,
          new_plan: plan,
          stripe_subscription_id: subscriptionId,
        })

        console.log(`checkout.session.completed: org ${org.id} upgraded to ${plan}`)
        break
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object
        const customerId = subscription.customer as string
        const subscriptionId = subscription.id as string

        const org = await getOrgByCustomerId(supabase, customerId)
        const plan = extractPlanFromSubscription(subscription)

        await updateOrgPlan(supabase, org.id, plan, subscriptionId)
        await logBillingEvent(supabase, org.id, 'plan_updated', `Organization plan updated to ${plan}`, {
          event_type: event.type,
          previous_plan: org.plan,
          new_plan: plan,
          subscription_status: subscription.status,
        })

        console.log(`customer.subscription.updated: org ${org.id} → ${plan}`)
        break
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object
        const customerId = subscription.customer as string

        const org = await getOrgByCustomerId(supabase, customerId)

        await updateOrgPlan(supabase, org.id, 'free', null)
        await logBillingEvent(supabase, org.id, 'plan_downgraded', 'Organization downgraded to free plan (subscription cancelled)', {
          event_type: event.type,
          previous_plan: org.plan,
          cancelled_subscription_id: subscription.id,
        })

        console.log(`customer.subscription.deleted: org ${org.id} downgraded to free`)
        break
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object
        const customerId = invoice.customer as string

        const org = await getOrgByCustomerId(supabase, customerId)

        await logBillingEvent(supabase, org.id, 'payment_failed', 'Invoice payment failed — action may be required', {
          event_type: event.type,
          invoice_id: invoice.id,
          amount_due: invoice.amount_due,
          currency: invoice.currency,
          attempt_count: invoice.attempt_count,
          next_payment_attempt: invoice.next_payment_attempt,
        })

        console.warn(`invoice.payment_failed: org ${org.id}, invoice ${invoice.id}`)
        break
      }

      default:
        console.log(`Unhandled Stripe event type: ${event.type}`)
    }
  } catch (err) {
    console.error(`Error handling ${event.type}:`, err)
    // Return 200 to Stripe to prevent retries on application-level errors.
    // The error is logged for investigation.
    return new Response(JSON.stringify({ received: true, error: 'Processing error logged' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
    status: 200,
  })
})
