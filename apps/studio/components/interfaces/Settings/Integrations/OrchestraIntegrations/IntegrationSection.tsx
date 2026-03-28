import { Loader2 } from 'lucide-react'
import { ReactNode } from 'react'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardFooter,
  Form_Shadcn_,
  FormControl_Shadcn_,
  FormField_Shadcn_,
  Input_Shadcn_,
  Switch,
  Textarea,
} from 'ui'
import { FormItemLayout } from 'ui-patterns/form/FormItemLayout/FormItemLayout'
import { UseFormReturn, FieldValues, Path } from 'react-hook-form'

interface FieldConfig<T extends FieldValues> {
  name: Path<T>
  label: string
  description?: string
  type: 'text' | 'password' | 'textarea' | 'readonly'
  placeholder?: string
}

interface IntegrationSectionProps<T extends FieldValues> {
  title: string
  description: string
  icon: ReactNode
  form: UseFormReturn<T>
  enabledFieldName: Path<T>
  fields: FieldConfig<T>[]
  isLoading: boolean
  isSaving: boolean
  onSubmit: (values: T) => void
  onTest?: () => void
  isTestLoading?: boolean
}

export function IntegrationSection<T extends FieldValues>({
  title,
  description,
  icon,
  form,
  enabledFieldName,
  fields,
  isLoading,
  isSaving,
  onSubmit,
  onTest,
  isTestLoading,
}: IntegrationSectionProps<T>) {
  const isEnabled = form.watch(enabledFieldName)

  return (
    <Form_Shadcn_ {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)}>
        <Card>
          <CardContent className="flex flex-col gap-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md border bg-surface-200">
                  {icon}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-foreground">{title}</h3>
                  <p className="text-xs text-foreground-light">{description}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {isLoading && (
                  <Loader2 className="animate-spin text-foreground-light" size={16} />
                )}
                <Badge variant={isEnabled ? 'success' : 'default'}>
                  {isEnabled ? 'Connected' : 'Not configured'}
                </Badge>
                <FormField_Shadcn_
                  control={form.control}
                  name={enabledFieldName}
                  render={({ field }) => (
                    <FormControl_Shadcn_>
                      <Switch
                        size="large"
                        checked={field.value as boolean}
                        onCheckedChange={field.onChange}
                        disabled={isLoading}
                      />
                    </FormControl_Shadcn_>
                  )}
                />
              </div>
            </div>

            {isEnabled && (
              <div className="flex flex-col gap-4 border-t pt-4">
                {fields.map((fieldConfig) => (
                  <FormField_Shadcn_
                    key={String(fieldConfig.name)}
                    control={form.control}
                    name={fieldConfig.name}
                    render={({ field }) => (
                      <FormItemLayout
                        layout="flex-row-reverse"
                        label={fieldConfig.label}
                        description={fieldConfig.description}
                        className="[&>div]:md:w-1/2"
                      >
                        <FormControl_Shadcn_>
                          {fieldConfig.type === 'textarea' ? (
                            <Textarea
                              {...field}
                              placeholder={fieldConfig.placeholder}
                              className="resize-none font-mono text-xs"
                              rows={4}
                              disabled={isLoading}
                            />
                          ) : (
                            <Input_Shadcn_
                              {...field}
                              type={fieldConfig.type === 'password' ? 'password' : 'text'}
                              placeholder={fieldConfig.placeholder}
                              readOnly={fieldConfig.type === 'readonly'}
                              disabled={isLoading || fieldConfig.type === 'readonly'}
                              autoComplete="off"
                              className={
                                fieldConfig.type === 'readonly'
                                  ? 'bg-surface-200 cursor-not-allowed'
                                  : ''
                              }
                            />
                          )}
                        </FormControl_Shadcn_>
                      </FormItemLayout>
                    )}
                  />
                ))}
              </div>
            )}
          </CardContent>

          {isEnabled && (
            <CardFooter className="justify-end space-x-2">
              {onTest && (
                <Button
                  type="default"
                  htmlType="button"
                  onClick={onTest}
                  disabled={isSaving || isTestLoading}
                  loading={isTestLoading}
                >
                  Send test
                </Button>
              )}
              {form.formState.isDirty && (
                <Button
                  type="default"
                  htmlType="button"
                  disabled={isSaving}
                  onClick={() => form.reset()}
                >
                  Cancel
                </Button>
              )}
              <Button
                type="primary"
                htmlType="submit"
                disabled={!form.formState.isDirty || isSaving}
                loading={isSaving}
              >
                Save
              </Button>
            </CardFooter>
          )}
        </Card>
      </form>
    </Form_Shadcn_>
  )
}
