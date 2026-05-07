import { useNavigate, useParams } from 'react-router-dom'

interface Tag {
  code: string
  title: string
  type: 'requirement' | 'feature' | 'usecase' | 'userstory'
  id?: string
  path?: string
}

interface Props {
  tags: (Tag | null | undefined)[]
}

const TYPE_STYLE: Record<string, string> = {
  requirement: 'bg-blue-100 text-blue-700 border-blue-200',
  feature: 'bg-purple-100 text-purple-700 border-purple-200',
  usecase: 'bg-indigo-100 text-indigo-700 border-indigo-200',
  userstory: 'bg-pink-100 text-pink-700 border-pink-200',
}

const TYPE_LABEL: Record<string, string> = {
  requirement: 'REQ',
  feature: 'F',
  usecase: 'UC',
  userstory: 'US',
}

export function AncestorTags({ tags }: Props) {
  const navigate = useNavigate()
  const { projectId } = useParams<{ projectId: string }>()

  const valid = tags.filter(Boolean) as Tag[]
  if (valid.length === 0) return null

  const getPath = (tag: Tag) => {
    if (tag.path) return tag.path
    if (!projectId || !tag.id) return undefined
    if (tag.type === 'requirement') return `/projects/${projectId}/requirements/${tag.id}`
    if (tag.type === 'feature') return `/projects/${projectId}/features/${tag.id}`
    if (tag.type === 'usecase') return `/projects/${projectId}/use-cases`
    if (tag.type === 'userstory') return `/projects/${projectId}/user-stories`
    return undefined
  }

  return (
    <div className="flex items-center flex-wrap gap-1.5">
      {valid.map((tag, i) => {
        const path = getPath(tag)
        const style = TYPE_STYLE[tag.type] || 'bg-gray-100 text-gray-600 border-gray-200'
        const label = TYPE_LABEL[tag.type] || '?'
        const title = tag.title.length > 22 ? tag.title.slice(0, 22) + '...' : tag.title
        return (
          <span
            key={i}
            title={tag.title}
            onClick={path ? (e) => { e.stopPropagation(); navigate(path) } : undefined}
            className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium border ${style} ${path ? 'cursor-pointer hover:opacity-80' : ''}`}
          >
            <span className="font-mono opacity-70">{label}-{tag.code.replace(/^[A-Z]+-/, '')}</span>
            <span>{title}</span>
          </span>
        )
      })}
    </div>
  )
}
