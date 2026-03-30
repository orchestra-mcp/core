import { Head } from '@inertiajs/react'
import DashboardLayout from '@/Layouts/DashboardLayout'
import { CreditCard, Check, Zap } from 'lucide-react'

interface Props {
    plan: string
    organization: {
        name: string
        stripe_customer_id: string | null
        stripe_subscription_id: string | null
    } | null
}

const plans = [
    {
        name: 'Free',
        key: 'free',
        price: '$0',
        period: 'forever',
        features: ['1 MCP Token', '3 Agents', '100 tasks/month', 'Community support'],
    },
    {
        name: 'Pro',
        key: 'pro',
        price: '$29',
        period: '/month',
        features: ['Unlimited Tokens', '25 Agents', '10,000 tasks/month', 'Priority support', 'Team sync'],
        popular: true,
    },
    {
        name: 'Enterprise',
        key: 'enterprise',
        price: 'Custom',
        period: '',
        features: ['Everything in Pro', 'Unlimited Agents', 'Unlimited tasks', 'Dedicated support', 'Custom integrations', 'SLA'],
    },
]

export default function Billing({ plan, organization }: Props) {
    return (
        <DashboardLayout title="Billing">
            <Head title="Billing" />

            {/* Page heading */}
            <div className="mb-6">
                <h1 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Billing
                </h1>
                <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                    Manage your subscription and billing information.
                </p>
            </div>

            {/* Current Plan */}
            <div
                className="rounded-lg p-6 mb-6"
                style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-sidebar)' }}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <h2 className="text-[13px] font-medium" style={{ color: 'var(--color-text-primary)' }}>
                            Current Plan
                        </h2>
                        <div className="flex items-center gap-2 mt-2">
                            <span
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[12px] font-semibold"
                                style={{
                                    background: plan === 'free' ? 'var(--color-bg-surface-300)' : 'rgba(169, 0, 255, 0.15)',
                                    color: plan === 'free' ? 'var(--color-text-secondary)' : '#c44dff',
                                }}
                            >
                                <Zap className="w-3 h-3" />
                                {plan.charAt(0).toUpperCase() + plan.slice(1)}
                            </span>
                            {organization && (
                                <span className="text-[12px]" style={{ color: 'var(--color-text-faint)' }}>
                                    for {organization.name}
                                </span>
                            )}
                        </div>
                    </div>
                    {plan !== 'enterprise' && (
                        <button className="btn-gradient">Upgrade Plan</button>
                    )}
                </div>
            </div>

            {/* Plan comparison */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                {plans.map((p) => (
                    <div
                        key={p.key}
                        className="rounded-lg p-5 relative"
                        style={{
                            border: p.key === plan
                                ? '1px solid #A900FF'
                                : p.popular
                                ? '1px solid var(--color-border-strong)'
                                : '1px solid var(--color-border)',
                            background: 'var(--color-bg-sidebar)',
                        }}
                    >
                        {p.popular && (
                            <span
                                className="absolute -top-2.5 left-4 px-2 py-0.5 rounded text-[10px] font-semibold"
                                style={{ background: '#A900FF', color: 'white' }}
                            >
                                Popular
                            </span>
                        )}
                        <h3 className="text-[14px] font-semibold mb-1" style={{ color: 'var(--color-text-primary)' }}>
                            {p.name}
                        </h3>
                        <div className="flex items-baseline gap-1 mb-4">
                            <span className="text-[24px] font-bold" style={{ color: 'var(--color-text-primary)' }}>
                                {p.price}
                            </span>
                            <span className="text-[12px]" style={{ color: 'var(--color-text-muted)' }}>
                                {p.period}
                            </span>
                        </div>
                        <ul className="space-y-2">
                            {p.features.map((feature) => (
                                <li key={feature} className="flex items-center gap-2 text-[12px]" style={{ color: 'var(--color-text-secondary)' }}>
                                    <Check className="w-3.5 h-3.5 shrink-0" style={{ color: '#34d399' }} />
                                    {feature}
                                </li>
                            ))}
                        </ul>
                        <div className="mt-4">
                            {p.key === plan ? (
                                <span className="text-[12px]" style={{ color: 'var(--color-text-faint)' }}>
                                    Current plan
                                </span>
                            ) : p.key === 'enterprise' ? (
                                <button className="btn-secondary w-full text-[12px]">Contact Sales</button>
                            ) : (
                                <button className="btn-primary w-full text-[12px]">
                                    {plans.findIndex((x) => x.key === p.key) > plans.findIndex((x) => x.key === plan)
                                        ? 'Upgrade'
                                        : 'Downgrade'}
                                </button>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Payment Method */}
            <div
                className="rounded-lg p-6"
                style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-sidebar)' }}
            >
                <h2 className="text-[13px] font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>
                    Payment Method
                </h2>
                {organization?.stripe_customer_id ? (
                    <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
                        <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                            Card on file
                        </span>
                        <button className="btn-secondary text-[12px] ml-auto">Update</button>
                    </div>
                ) : (
                    <div className="text-center py-6">
                        <CreditCard className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-faint)' }} />
                        <p className="text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                            No payment method on file.
                        </p>
                        <button className="btn-secondary mt-3 text-[12px]">Add Payment Method</button>
                    </div>
                )}
            </div>
        </DashboardLayout>
    )
}
