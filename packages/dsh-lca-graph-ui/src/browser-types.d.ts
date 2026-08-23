declare module '*.css?inline' {
  const text: string
  export default text
}

declare module '@deepseek-ai/dsh-client-ui-primitives' {
  import type { ComponentType } from 'react'

  interface IconProps {
    size?: number
    className?: string
  }

  export const IconCloseOutline16: ComponentType<IconProps>
  export const IconChevronDownOutline14: ComponentType<IconProps>
  export const IconDataOutline16: ComponentType<IconProps>
  export const IconDownloadOutline16: ComponentType<IconProps>
  export const IconFullscreenOutline16: ComponentType<IconProps>
  export const IconRefreshOutline16: ComponentType<IconProps>
  export const IconSearchOutline16: ComponentType<IconProps>
}
