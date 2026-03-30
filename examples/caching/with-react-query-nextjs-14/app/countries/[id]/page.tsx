'use client'

import { useQuery } from '@supabase-cache-helpers/postgrest-react-query'

import { getCountryById } from '@/queries/get-country-by-id'
import useSupabaseBrowser from '@/utils/supabase-browser'

export default function CountryPage({ params }: { params: { id: number } }) {
  const supabase = useSupabaseBrowser()
  const { data: country, isLoading, isError } = useQuery(getCountryById(supabase, params.id))

  if (isLoading) {
    return <div>Loading...</div>
  }

  if (isError || !country) {
    return <div>Error</div>
  }

  return (
    <div>
      <h1>{country.name}</h1>
    </div>
  )
}
