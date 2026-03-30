import { createInertiaApp } from '@inertiajs/react'
import { createRoot } from 'react-dom/client'

createInertiaApp({
    title: (title) => title ? `${title} - Orchestra MCP` : 'Dashboard - Orchestra MCP',
    resolve: (name) => {
        const pages = import.meta.glob('./Pages/**/*.tsx', { eager: true }) as Record<string, any>
        const page = pages[`./Pages/${name}.tsx`]
        if (!page) {
            throw new Error(`Page not found: ${name}`)
        }
        return page
    },
    setup({ el, App, props }) {
        createRoot(el).render(<App {...props} />)
    },
})
