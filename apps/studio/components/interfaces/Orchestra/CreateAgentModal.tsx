import { zodResolver } from '@hookform/resolvers/zod'
import { useParams } from 'common'
import { useMemo } from 'react'
import { SubmitHandler, useForm } from 'react-hook-form'
import {
  Button,
  Form_Shadcn_,
  FormControl_Shadcn_,
  FormField_Shadcn_,
  Input_Shadcn_,
  Modal,
  Select_Shadcn_,
  SelectContent_Shadcn_,
  SelectItem_Shadcn_,
  SelectTrigger_Shadcn_,
  SelectValue_Shadcn_,
  Textarea,
} from 'ui'
import { FormItemLayout } from 'ui-patterns/form/FormItemLayout/FormItemLayout'
import * as z from 'zod'

import { useCreateOrchestraAgentMutation } from '@/data/orchestra/orchestra-agent-create-mutation'

const formSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  slug: z.string().min(1, 'Slug is required'),
  role: z.string().min(1, 'Role is required'),
  type: z.enum(['ai', 'person']),
  persona: z.string().optional(),
  system_prompt: z.string().optional(),
  avatar_url: z.string().optional(),
  team_id: z.string().optional(),
})

type CreateAgentForm = z.infer<typeof formSchema>

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
}

export interface CreateAgentModalProps {
  visible: boolean
  onClose: () => void
}

export const CreateAgentModal = ({ visible, onClose }: CreateAgentModalProps) => {
  const { ref } = useParams()
  const { mutate: createAgent, isPending: isCreating } = useCreateOrchestraAgentMutation()

  const form = useForm<CreateAgentForm>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: '',
      slug: '',
      role: '',
      type: 'ai',
      persona: '',
      system_prompt: '',
      avatar_url: '',
      team_id: '',
    },
  })

  const { isDirty } = form.formState

  const watchName = form.watch('name')
  const autoSlug = useMemo(() => slugify(watchName || ''), [watchName])

  const handleSubmit: SubmitHandler<CreateAgentForm> = (values) => {
    if (!ref) return

    createAgent(
      {
        projectRef: ref,
        name: values.name,
        slug: values.slug || autoSlug,
        role: values.role,
        type: values.type,
        persona: values.persona || undefined,
        system_prompt: values.system_prompt || undefined,
        avatar_url: values.avatar_url || undefined,
        team_id: values.team_id || undefined,
      },
      {
        onSuccess: () => {
          form.reset()
          onClose()
        },
      }
    )
  }

  const handleCancel = () => {
    form.reset()
    onClose()
  }

  return (
    <Modal visible={visible} onCancel={handleCancel} hideFooter header="Create Agent" size="medium">
      <Form_Shadcn_ {...form}>
        <form onSubmit={form.handleSubmit(handleSubmit)} noValidate>
          <Modal.Content className="flex flex-col gap-4">
            <FormField_Shadcn_
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItemLayout name="name" layout="vertical" label="Name">
                  <FormControl_Shadcn_>
                    <Input_Shadcn_
                      {...field}
                      id="name"
                      placeholder="e.g. Omar the Laravel Developer"
                      onChange={(e) => {
                        field.onChange(e)
                        // Auto-fill slug if user hasn't manually changed it
                        const currentSlug = form.getValues('slug')
                        const prevAutoSlug = slugify(field.value)
                        if (!currentSlug || currentSlug === prevAutoSlug) {
                          form.setValue('slug', slugify(e.target.value))
                        }
                      }}
                    />
                  </FormControl_Shadcn_>
                </FormItemLayout>
              )}
            />

            <FormField_Shadcn_
              control={form.control}
              name="slug"
              render={({ field }) => (
                <FormItemLayout name="slug" layout="vertical" label="Slug">
                  <FormControl_Shadcn_>
                    <Input_Shadcn_ {...field} id="slug" placeholder="auto-generated-from-name" />
                  </FormControl_Shadcn_>
                </FormItemLayout>
              )}
            />

            <div className="grid grid-cols-2 gap-4">
              <FormField_Shadcn_
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItemLayout name="role" layout="vertical" label="Role">
                    <FormControl_Shadcn_>
                      <Input_Shadcn_ {...field} id="role" placeholder="e.g. Developer, QA, PM" />
                    </FormControl_Shadcn_>
                  </FormItemLayout>
                )}
              />

              <FormField_Shadcn_
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FormItemLayout name="type" layout="vertical" label="Type">
                    <Select_Shadcn_ value={field.value} onValueChange={field.onChange}>
                      <FormControl_Shadcn_>
                        <SelectTrigger_Shadcn_>
                          <SelectValue_Shadcn_ placeholder="Select type" />
                        </SelectTrigger_Shadcn_>
                      </FormControl_Shadcn_>
                      <SelectContent_Shadcn_>
                        <SelectItem_Shadcn_ value="ai">AI Agent</SelectItem_Shadcn_>
                        <SelectItem_Shadcn_ value="person">Person</SelectItem_Shadcn_>
                      </SelectContent_Shadcn_>
                    </Select_Shadcn_>
                  </FormItemLayout>
                )}
              />
            </div>

            <FormField_Shadcn_
              control={form.control}
              name="persona"
              render={({ field }) => (
                <FormItemLayout name="persona" layout="vertical" label="Persona">
                  <FormControl_Shadcn_>
                    <Textarea
                      {...field}
                      id="persona"
                      rows={3}
                      placeholder="Describe the agent's personality and background..."
                      className="resize-none"
                    />
                  </FormControl_Shadcn_>
                </FormItemLayout>
              )}
            />

            <FormField_Shadcn_
              control={form.control}
              name="system_prompt"
              render={({ field }) => (
                <FormItemLayout name="system_prompt" layout="vertical" label="System Prompt">
                  <FormControl_Shadcn_>
                    <Textarea
                      {...field}
                      id="system_prompt"
                      rows={4}
                      placeholder="System-level instructions for the agent..."
                      className="resize-none font-mono text-sm"
                    />
                  </FormControl_Shadcn_>
                </FormItemLayout>
              )}
            />

            <FormField_Shadcn_
              control={form.control}
              name="avatar_url"
              render={({ field }) => (
                <FormItemLayout name="avatar_url" layout="vertical" label="Avatar URL">
                  <FormControl_Shadcn_>
                    <Input_Shadcn_
                      {...field}
                      id="avatar_url"
                      placeholder="https://example.com/avatar.png"
                    />
                  </FormControl_Shadcn_>
                </FormItemLayout>
              )}
            />

            <FormField_Shadcn_
              control={form.control}
              name="team_id"
              render={({ field }) => (
                <FormItemLayout name="team_id" layout="vertical" label="Team ID">
                  <FormControl_Shadcn_>
                    <Input_Shadcn_
                      {...field}
                      id="team_id"
                      placeholder="UUID of the team (optional)"
                    />
                  </FormControl_Shadcn_>
                </FormItemLayout>
              )}
            />
          </Modal.Content>

          <Modal.Separator />

          <Modal.Content className="flex items-center justify-end gap-2">
            <Button htmlType="reset" type="default" onClick={handleCancel} disabled={isCreating}>
              Cancel
            </Button>
            <Button htmlType="submit" loading={isCreating} disabled={isCreating || !isDirty}>
              Create Agent
            </Button>
          </Modal.Content>
        </form>
      </Form_Shadcn_>
    </Modal>
  )
}
