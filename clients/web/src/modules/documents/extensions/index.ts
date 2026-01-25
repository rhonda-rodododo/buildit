/**
 * TipTap Extensions Index
 * Custom extensions for advanced document features
 *
 * Epic 56: Advanced Document Features
 */

export { CommentMark, type CommentMarkOptions } from './CommentMark'
export { SuggestionMark, type SuggestionMarkOptions, type SuggestionType } from './SuggestionMark'
export { MathBlock, type MathBlockOptions } from './MathBlock'
export { MermaidBlock, type MermaidBlockOptions } from './MermaidBlock'
export { TableOfContents, type TableOfContentsOptions } from './TableOfContents'
export { Footnote, type FootnoteOptions } from './Footnote'
export { SuggestionModeExtension, type SuggestionModeOptions, suggestionModePluginKey } from './SuggestionModePlugin'
// Epic 56: Page breaks, Headers/Footers, Mentions
export { PageBreak, type PageBreakExtensionOptions } from './PageBreak'
export { HeaderFooter, type HeaderFooterExtensionOptions, type HeaderFooterPosition } from './HeaderFooter'
export {
  createMentionExtension,
  MentionRenderer,
  MentionList,
  mentionStyles,
  type MentionExtensionOptions,
  type MentionUser,
  type MentionListProps,
  type MentionListRef,
} from './MentionExtension'
