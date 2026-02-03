/**
 * WikiView — Main wiki module view
 * State-driven: shows page list or editor based on currentPageId
 */

import { FC, useCallback } from 'react'
import { useWikiStore } from '../wikiStore'
import { WikiPageList } from './WikiPageList'
import { WikiEditor } from './WikiEditor'

interface WikiViewProps {
  groupId?: string
}

export const WikiView: FC<WikiViewProps> = ({ groupId = 'global' }) => {
  const currentPageId = useWikiStore((s) => s.currentPageId)
  const pages = useWikiStore((s) => s.pages)
  const setCurrentPage = useWikiStore((s) => s.setCurrentPage)
  const createPage = useWikiStore((s) => s.createPage)

  const currentPage = currentPageId ? pages[currentPageId] : undefined

  const handleCreatePage = useCallback(() => {
    createPage(groupId)
  }, [createPage, groupId])

  const handleSelectPage = useCallback(
    (pageId: string) => {
      setCurrentPage(pageId)
    },
    [setCurrentPage],
  )

  const handleBack = useCallback(() => {
    setCurrentPage(null)
  }, [setCurrentPage])

  if (currentPage) {
    return (
      <WikiEditor page={currentPage} groupId={groupId} onBack={handleBack} />
    )
  }

  return (
    <WikiPageList
      groupId={groupId}
      onCreatePage={handleCreatePage}
      onSelectPage={handleSelectPage}
    />
  )
}
