import { Head, useForm } from '@inertiajs/react'
import DashboardLayout from '@/Layouts/DashboardLayout'

interface Props {
    profile: {
        name: string
        email: string
        timezone: string
        language: string
        notification_preferences: Record<string, boolean>
    }
}

export default function Settings({ profile }: Props) {
    const { data, setData, processing } = useForm({
        name: profile.name,
        email: profile.email,
        timezone: profile.timezone,
        language: profile.language,
    })

    return (
        <DashboardLayout title="Settings">
            <Head title="Settings" />

            {/* Page heading */}
            <div className="mb-6">
                <h1 className="text-[14px] font-semibold" style={{ color: 'var(--color-text-primary)' }}>
                    Project Settings
                </h1>
                <p className="mt-1 text-[13px]" style={{ color: 'var(--color-text-muted)' }}>
                    Manage your account settings and preferences.
                </p>
            </div>

            {/* Profile Section */}
            <div
                className="rounded-lg p-6 mb-6"
                style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-sidebar)' }}
            >
                <h2 className="text-[13px] font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>
                    Profile
                </h2>
                <div className="space-y-4 max-w-md">
                    <div>
                        <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Full Name
                        </label>
                        <input
                            type="text"
                            className="studio-field w-full"
                            value={data.name}
                            onChange={(e) => setData('name', e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Email
                        </label>
                        <input
                            type="email"
                            className="studio-field w-full"
                            value={data.email}
                            disabled
                            readOnly
                        />
                        <p className="mt-1 text-[11px]" style={{ color: 'var(--color-text-faint)' }}>
                            Email changes are not supported at this time.
                        </p>
                    </div>
                    <div>
                        <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Timezone
                        </label>
                        <select
                            className="studio-field w-full"
                            value={data.timezone}
                            onChange={(e) => setData('timezone', e.target.value)}
                        >
                            <option value="UTC">UTC</option>
                            <option value="America/New_York">Eastern Time</option>
                            <option value="America/Chicago">Central Time</option>
                            <option value="America/Denver">Mountain Time</option>
                            <option value="America/Los_Angeles">Pacific Time</option>
                            <option value="Europe/London">London</option>
                            <option value="Europe/Berlin">Berlin</option>
                            <option value="Asia/Tokyo">Tokyo</option>
                            <option value="Africa/Cairo">Cairo</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-[12px] font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)' }}>
                            Language
                        </label>
                        <select
                            className="studio-field w-full"
                            value={data.language}
                            onChange={(e) => setData('language', e.target.value)}
                        >
                            <option value="en">English</option>
                            <option value="ar">Arabic</option>
                            <option value="es">Spanish</option>
                            <option value="fr">French</option>
                            <option value="de">German</option>
                            <option value="ja">Japanese</option>
                        </select>
                    </div>
                    <div className="pt-2">
                        <button className="btn-primary" disabled={processing}>
                            Save Changes
                        </button>
                    </div>
                </div>
            </div>

            {/* Notification Preferences */}
            <div
                className="rounded-lg p-6 mb-6"
                style={{ border: '1px solid var(--color-border)', background: 'var(--color-bg-sidebar)' }}
            >
                <h2 className="text-[13px] font-medium mb-4" style={{ color: 'var(--color-text-primary)' }}>
                    Notification Preferences
                </h2>
                <div className="space-y-3 max-w-md">
                    {[
                        { key: 'task_assigned', label: 'Task assignments' },
                        { key: 'task_completed', label: 'Task completions' },
                        { key: 'agent_online', label: 'Agent online/offline' },
                        { key: 'mentions', label: 'Mentions' },
                        { key: 'system', label: 'System notifications' },
                    ].map((pref) => (
                        <label key={pref.key} className="flex items-center justify-between cursor-pointer py-1">
                            <span className="text-[13px]" style={{ color: 'var(--color-text-secondary)' }}>
                                {pref.label}
                            </span>
                            <div className="relative">
                                <input type="checkbox" className="sr-only peer" defaultChecked />
                                <div
                                    className="w-9 h-5 rounded-full peer-checked:bg-[#A900FF] transition-colors"
                                    style={{ background: 'var(--color-bg-surface-300)' }}
                                />
                                <div className="absolute left-0.5 top-0.5 w-4 h-4 rounded-full bg-white transition-transform peer-checked:translate-x-4" />
                            </div>
                        </label>
                    ))}
                </div>
            </div>

            {/* Danger Zone */}
            <div
                className="rounded-lg p-6"
                style={{ border: '1px solid hsl(10.2 77.9% 53.9% / 0.3)', background: 'var(--color-bg-sidebar)' }}
            >
                <h2 className="text-[13px] font-medium mb-2" style={{ color: 'hsl(9.7 85.2% 62.9%)' }}>
                    Danger Zone
                </h2>
                <p className="text-[12px] mb-4" style={{ color: 'var(--color-text-muted)' }}>
                    These actions are permanent and cannot be undone.
                </p>
                <div className="flex gap-2">
                    <button className="btn-danger">Delete Account</button>
                </div>
            </div>
        </DashboardLayout>
    )
}
