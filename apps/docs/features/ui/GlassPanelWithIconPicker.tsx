import MenuIconPicker from '~/components/Navigation/NavigationMenu/MenuIconPicker'
import { type ComponentProps, type PropsWithChildren } from 'react'
import { GlassPanel } from 'ui-patterns/GlassPanel'

type GlassPanelWithIconPickerProps = PropsWithChildren<
  Omit<ComponentProps<typeof GlassPanel>, 'icon'> & { icon: string }
>

function GlassPanelWithIconPicker({ children, icon, ...props }: GlassPanelWithIconPickerProps) {
  return (
    <GlassPanel icon={<MenuIconPicker icon={icon} width={18} height={18} />} {...props}>
      {children}
    </GlassPanel>
  )
}

export { GlassPanelWithIconPicker }
