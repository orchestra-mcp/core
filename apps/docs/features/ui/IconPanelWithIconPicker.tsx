import MenuIconPicker from '~/components/Navigation/NavigationMenu/MenuIconPicker'
import { type ComponentProps } from 'react'
import { IconPanel } from 'ui-patterns/IconPanel'

type IconPanelWithIconPickerProps = Omit<ComponentProps<typeof IconPanel>, 'icon'> & {
  icon: string
}

function IconPanelWithIconPicker({ icon, ...props }: IconPanelWithIconPickerProps) {
  return <IconPanel icon={<MenuIconPicker icon={icon} width={18} height={18} />} {...props} />
}

export { IconPanelWithIconPicker }
