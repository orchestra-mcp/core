import CodeWindow from '~/components/CodeWindow'
import React from 'react'

const code = `const supabase = createClient(
  Deno.env.get('SUPABASE_URL'),
  Deno.env.get('SUPABASE_ANON_KEY')
)`

const ZeroConfigPanel = () => (
  <CodeWindow className="[&_.synthax-highlighter]:md:!min-h-[300px]" code={code} showLineNumbers />
)

export default ZeroConfigPanel
