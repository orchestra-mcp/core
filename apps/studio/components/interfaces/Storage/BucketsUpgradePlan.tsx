import { AlphaNotice } from 'components/ui/AlphaNotice'
import { UpgradePlanButton } from 'components/ui/UpgradePlanButton'
import { AnalyticsBucket as AnalyticsBucketIcon, VectorBucket as VectorBucketIcon } from 'icons'
import { IS_PLATFORM } from 'lib/constants'
import { EmptyStatePresentational } from 'ui-patterns'
import { PageContainer } from 'ui-patterns/PageContainer'
import { PageSection, PageSectionContent } from 'ui-patterns/PageSection'
import { BUCKET_TYPES } from './Storage.constants'

export const BucketsUpgradePlan = ({ type }: { type: 'analytics' | 'vector' }) => {
  return (
    <PageContainer>
      <PageSection>
        <PageSectionContent className="flex flex-col gap-y-8">
          <AlphaNotice
            entity={type === 'analytics' ? 'Analytics buckets' : 'Vector buckets'}
            feedbackUrl={
              type === 'analytics'
                ? 'https://github.com/orgs/supabase/discussions/40116'
                : 'https://github.com/orgs/supabase/discussions/40815'
            }
          />
          <EmptyStatePresentational
            icon={type === 'analytics' ? AnalyticsBucketIcon : VectorBucketIcon}
            title={
              type === 'analytics'
                ? BUCKET_TYPES.analytics.valueProp
                : BUCKET_TYPES.vectors.valueProp
            }
            description={
              IS_PLATFORM
                ? `Upgrade to Pro to use ${type} buckets for your project`
                : `${type === 'analytics' ? 'Analytics' : 'Vector'} buckets are not enabled for this project`
            }
          >
            {IS_PLATFORM && (
              <div className="flex items-center gap-x-2">
                <UpgradePlanButton
                  source={`${type}Buckets`}
                  featureProposition={`use ${type} buckets`}
                />
              </div>
            )}
          </EmptyStatePresentational>
        </PageSectionContent>
      </PageSection>
    </PageContainer>
  )
}
