import { MemoryList } from "@/features/memories/memory-list";
import { TrialNotice } from "@/features/trial/trial-notice";
export default function Page() {
  return (
    <>
      <div className="gallery-header">
        <h1 className="page-title">보관함</h1>
        <div className="gallery-controls">
          {/* Search and view toggle — functional when backed by real data */}
          <button className="icon-btn" aria-label="검색" disabled title="준비 중">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
              <circle cx="11" cy="11" r="7"/>
              <line x1="16.5" y1="16.5" x2="22" y2="22"/>
            </svg>
          </button>
          <button className="icon-btn" aria-label="보기 방식" disabled title="준비 중">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/>
              <rect x="14" y="3" width="7" height="7"/>
              <rect x="3" y="14" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/>
            </svg>
          </button>
        </div>
      </div>
      <TrialNotice />
      <MemoryList />
    </>
  );
}
