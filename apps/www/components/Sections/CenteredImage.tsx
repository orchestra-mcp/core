import SectionContainer from '~/components/Layouts/SectionContainer'
import React from 'react'
import { cn } from 'ui'

interface Props {
  image: any
  className?: string
}

const CenteredImage = ({ image: Image, className }: Props) => {
  return (
    <SectionContainer className={cn('flex flex-col items-center text-center', className)}>
      <div className="w-full max-w-6xl flex justify-center items-center mx-auto">
        <Image />
      </div>
    </SectionContainer>
  )
}

export default CenteredImage
