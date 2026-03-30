import { useParams } from 'common'
import type { ProductMenuGroup } from 'components/ui/ProductMenu/ProductMenu.types'

export function generateOrchestraMenu(ref?: string): ProductMenuGroup[] {
  const baseUrl = `/project/${ref}/orchestra`

  return [
    {
      title: 'Overview',
      items: [{ name: 'Dashboard', key: 'orchestra', url: baseUrl, items: [] }],
    },
    {
      title: 'Manage',
      items: [
        { name: 'Agents', key: 'agents', url: `${baseUrl}/agents`, items: [] },
        { name: 'Tokens', key: 'tokens', url: `${baseUrl}/tokens`, items: [] },
        { name: 'Feature Flags', key: 'feature-flags', url: `${baseUrl}/feature-flags`, items: [] },
      ],
    },
    {
      title: 'Resources',
      items: [
        { name: 'Docs', key: 'docs', url: `${baseUrl}/docs`, items: [] },
      ],
    },
  ]
}

export const useGenerateOrchestraMenu = (): ProductMenuGroup[] => {
  const { ref } = useParams()
  return generateOrchestraMenu(ref)
}
