import React, { useState, useEffect } from 'react';
import { Typography, message, Button, Space, Tag, Progress, List, Avatar, Popover, Mentions, Popconfirm, Tooltip, Divider } from 'antd';
import { DeleteOutlined, UserOutlined, SmileOutlined, FileOutlined, LinkOutlined, EditOutlined, ArrowRightOutlined, FileTextOutlined, DownloadOutlined, SendOutlined } from '@ant-design/icons';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { useNavigate } from 'react-router-dom';
import { Item, Comment, User, FileAttachment, Link, WorkRequestPriority, WorkRequestStatus } from '../types';
import { itemsApi } from '../api/items';
import { commentsApi } from '../api/comments';
import { filesApi } from '../api/files';
import { linksApi } from '../api/links';
import { useAuthStore } from '../store/authStore';

interface ItemDetailModalProps {
  item: Item | null;
  open: boolean;
  onClose: () => void;
  onEdit: (item: Item) => void;
  onDelete: (id: string) => void;
  onItemClick: (item: Item) => void;
  users: User[];
}

const typeLabels = {
  PROJECT: '프로젝트',
  SERVICE: '서비스',
  TEAM: '팀',
  ACTION: '액션',
};

const statusLabels = {
  NOT_STARTED: '시작 전',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '대기',
};

export const ItemDetailModal: React.FC<ItemDetailModalProps> = ({
  item,
  open,
  onClose,
  onEdit,
  onDelete,
  onItemClick,
  users,
}) => {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [relatedDocs, setRelatedDocs] = useState<Array<{ type: 'file' | 'link', data: FileAttachment | Link }>>([]);

  useEffect(() => {
    if (item) {
      fetchComments(item.id);
      loadRelatedDocuments(item.id);
    } else {
      setComments([]);
      setCommentContent('');
      setRelatedDocs([]);
    }
  }, [item]);

  const fetchComments = async (itemId: string) => {
    try {
      const data = await commentsApi.getCommentsByItem(itemId);
      setComments(data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const loadRelatedDocuments = async (itemId: string) => {
    try {
      const { files: hierarchicalFiles, links: hierarchicalLinks } = await filesApi.getHierarchicalDocuments(itemId);

      const combined: Array<{ type: 'file' | 'link', data: FileAttachment | Link }> = [
        ...hierarchicalFiles.map(f => ({ type: 'file' as const, data: f })),
        ...hierarchicalLinks.map(l => ({ type: 'link' as const, data: l })),
      ];

      combined.sort((a, b) => {
        const dateA = new Date(a.data.createdAt).getTime();
        const dateB = new Date(b.data.createdAt).getTime();
        return dateB - dateA;
      });

      setRelatedDocs(combined);
    } catch (error) {
      console.error('Failed to load related documents:', error);
    }
  };

  const handleAddComment = async () => {
    if (!item || !commentContent.trim()) return;

    try {
      await commentsApi.createComment(item.id, commentContent.trim());
      setCommentContent('');
      await fetchComments(item.id);
      message.success('댓글이 추가되었습니다');
    } catch (error: any) {
      message.error('댓글 추가 실패: ' + error.message);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!item) return;

    try {
      await commentsApi.deleteComment(commentId);
      await fetchComments(item.id);
      message.success('댓글이 삭제되었습니다');
    } catch (error: any) {
      message.error('댓글 삭제 실패: ' + error.message);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setCommentContent(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
  };

  const handleReactionToggle = async (commentId: string, emoji: string) => {
    if (!item) return;

    try {
      await commentsApi.toggleReaction(commentId, emoji);
      await fetchComments(item.id);
    } catch (error: any) {
      message.error('반응 추가/제거에 실패했습니다.');
    }
  };

  const handleDeleteRelatedDoc = async (docType: 'file' | 'link', docId: string) => {
    try {
      if (docType === 'file') {
        await filesApi.deleteFile(docId);
        message.success('파일이 삭제되었습니다.');
      } else {
        await linksApi.deleteLink(docId);
        message.success('링크가 삭제되었습니다.');
      }
      if (item) {
        await loadRelatedDocuments(item.id);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || `${docType === 'file' ? '파일' : '링크'} 삭제에 실패했습니다.`);
    }
  };

  const handleChildItemClick = async (childItem: Item) => {
    try {
      const fullItem = await itemsApi.getItemById(childItem.id);
      onItemClick(fullItem);
    } catch (error) {
      console.error('Failed to load item:', error);
      onItemClick(childItem);
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const renderCommentContent = (content: string) => {
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      parts.push(
        <span
          key={match.index}
          style={{
            backgroundColor: '#e6f7ff',
            color: '#1890ff',
            padding: '2px 6px',
            borderRadius: '4px',
            fontWeight: 500,
            display: 'inline-block',
            margin: '0 2px',
          }}
        >
          @{match[1]}
        </span>
      );
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

  const getPriorityLabel = (priority: WorkRequestPriority): string => {
    switch (priority) {
      case WorkRequestPriority.LOW: return '낮음';
      case WorkRequestPriority.MEDIUM: return '보통';
      case WorkRequestPriority.HIGH: return '높음';
      case WorkRequestPriority.URGENT: return '긴급';
      default: return priority;
    }
  };

  const getPriorityColor = (priority: WorkRequestPriority): string => {
    switch (priority) {
      case WorkRequestPriority.LOW: return '#52c41a';
      case WorkRequestPriority.MEDIUM: return '#1890ff';
      case WorkRequestPriority.HIGH: return '#fa8c16';
      case WorkRequestPriority.URGENT: return '#f5222d';
      default: return '#d9d9d9';
    }
  };

  const getWorkRequestStatusLabel = (status: WorkRequestStatus): string => {
    switch (status) {
      case WorkRequestStatus.PENDING: return '대기';
      case WorkRequestStatus.IN_PROGRESS: return '진행중';
      case WorkRequestStatus.COMPLETED: return '완료';
      case WorkRequestStatus.CANCELLED: return '취소';
      default: return status;
    }
  };

  const getWorkRequestStatusColor = (status: WorkRequestStatus): string => {
    switch (status) {
      case WorkRequestStatus.PENDING: return 'default';
      case WorkRequestStatus.IN_PROGRESS: return 'blue';
      case WorkRequestStatus.COMPLETED: return 'green';
      case WorkRequestStatus.CANCELLED: return 'red';
      default: return 'default';
    }
  };

  const handleGoToWorkRequest = (workRequestId: string) => {
    onClose();
    navigate(`/requests?workRequestId=${workRequestId}`);
  };

  return (
    <div
      style={{
        flex: open && item ? '0 0 60%' : '0 0 0%',
        overflow: 'hidden',
        transition: 'flex 0.3s ease-in-out',
        marginBottom: open && item ? 16 : 0,
        backgroundColor: '#fff',
        border: open && item ? '1px solid #d9d9d9' : 'none',
        borderRadius: '6px',
        position: 'relative',
      }}
    >
      {open && item && (
        <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
          {/* 헤더 영역 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 24 }}>
            {/* 좌측: PSTA 구분 + 상태 */}
            <div style={{ display: 'flex', gap: '6px' }}>
            <Tag color={
              item.type === 'PROJECT' ? 'purple' :
              item.type === 'SERVICE' ? 'blue' :
              item.type === 'TEAM' ? 'green' : 'orange'
            } style={{ fontSize: '12px', padding: '2px 8px', margin: 0 }}>
              {typeLabels[item.type as keyof typeof typeLabels]}
            </Tag>
            <Tag color={
              item.status === 'COMPLETED' ? 'success' :
              item.status === 'IN_PROGRESS' ? 'processing' :
              item.status === 'ON_HOLD' ? 'warning' : 'default'
            } style={{ fontSize: '12px', padding: '2px 8px', margin: 0 }}>
              {statusLabels[item.status as keyof typeof statusLabels]}
            </Tag>
          </div>

          {/* 중앙: 제목 (50% 이상) */}
          <div style={{ flex: '1 1 50%', minWidth: 0 }}>
            <Typography.Title level={4} style={{ margin: 0, wordBreak: 'break-word' }}>
              {item.name}
            </Typography.Title>
          </div>

          {/* 우측: 기간 + 진행률 + 수정/삭제 버튼 */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            <div style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap' }}>
              {item.startDate && item.endDate ? (
                <>
                  {new Date(item.startDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                  {' → '}
                  {new Date(item.endDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                </>
              ) : '기간 미정'}
            </div>
            <Progress
              type="circle"
              percent={item.progress || 0}
              size={50}
              strokeWidth={8}
            />

            {/* 수정 버튼 */}
            {(() => {
              const isTeam = item.type === 'TEAM';
              const canModify = user?.role === 'ADMIN' || item.createdById === user?.id;
              const isDisabled = isTeam || !canModify;
              const tooltipText = isTeam
                ? '팀은 수정할 수 없습니다'
                : !canModify
                ? '생성자 또는 최고관리자만 수정할 수 있습니다'
                : '';

              return (
                <Tooltip title={tooltipText}>
                  <Button
                    icon={<EditOutlined />}
                    onClick={() => onEdit(item)}
                    type="default"
                    disabled={isDisabled}
                  >
                    수정
                  </Button>
                </Tooltip>
              );
            })()}

            {/* 삭제 버튼 */}
            {(() => {
              const hasChildren = item.children && item.children.length > 0;
              const canModify = user?.role === 'ADMIN' || item.createdById === user?.id;
              const isDisabled = hasChildren || !canModify;
              const tooltipText = hasChildren
                ? '하위 항목이 있어 삭제할 수 없습니다'
                : !canModify
                ? '생성자 또는 최고관리자만 삭제할 수 있습니다'
                : '';

              return (
                <Popconfirm
                  title="항목 삭제"
                  description={
                    hasChildren
                      ? "하위 항목이 있어 삭제할 수 없습니다."
                      : "이 항목을 삭제하시겠습니까?"
                  }
                  onConfirm={() => {
                    if (!hasChildren) {
                      onDelete(item.id);
                      onClose();
                    }
                  }}
                  okText="삭제"
                  cancelText="취소"
                  okButtonProps={{
                    disabled: isDisabled,
                    danger: true
                  }}
                  disabled={isDisabled}
                >
                  <Tooltip title={tooltipText}>
                    <span style={{ display: 'inline-block' }}>
                      <Button
                        danger
                        icon={<DeleteOutlined />}
                        disabled={isDisabled}
                      >
                        삭제
                      </Button>
                    </span>
                  </Tooltip>
                </Popconfirm>
              );
            })()}
          </div>

          {/* 닫기 버튼 */}
          <Button onClick={onClose} type="text">
            ✕
          </Button>
        </div>

        {/* 상세 정보 영역 - 70% / 30% 레이아웃 */}
        <div style={{ display: 'flex', gap: '20px', height: 'calc(100% - 80px)' }}>
          {/* 왼쪽 영역 (70%) - 상세 정보 */}
          <div style={{ flex: '0 0 70%', overflowY: 'auto', paddingRight: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: 16 }}>
              <div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 4 }}>고객</div>
                  <div style={{ fontWeight: 500 }}>{item.Client?.name || '-'}</div>
                </div>
              </div>
              <div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 4 }}>담당자</div>
                  <div style={{ fontWeight: 500 }}>{item.User_Item_assigneeIdToUser?.displayName || '-'}</div>
                </div>
              </div>
            </div>

            <div style={{ marginBottom: 16 }}>
              <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 4 }}>설명</div>
              <div style={{ padding: '12px', backgroundColor: '#fafafa', borderRadius: '4px' }}>
                {item.description ? (
                  <div
                    className="description-html-view"
                    dangerouslySetInnerHTML={{ __html: item.description }}
                  />
                ) : (
                  <span style={{ color: '#bfbfbf', fontStyle: 'italic' }}>등록된 설명이 없습니다.</span>
                )}
              </div>
            </div>

            {/* 연결된 작업 요청 */}
            {item.type === 'ACTION' && item.WorkRequest && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 8 }}>
                  연결된 작업 요청
                </div>
                <div
                  style={{
                    background: 'white',
                    border: '1px solid #f0f0f0',
                    borderRadius: 8,
                    padding: 16,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                  }}
                  onClick={() => handleGoToWorkRequest(item.WorkRequest!.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                    e.currentTarget.style.borderColor = '#1890ff';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.borderColor = '#f0f0f0';
                  }}
                >
                  <div style={{ display: 'flex', gap: 16, alignItems: 'flex-start' }}>
                    <div
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: 8,
                        background: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                        boxShadow: '0 2px 8px rgba(24, 144, 255, 0.3)',
                      }}
                    >
                      <FileTextOutlined style={{ fontSize: 24, color: 'white' }} />
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8, lineHeight: 1.4 }}>
                        {item.WorkRequest.title}
                      </div>
                      <Space size={8} wrap>
                        <Tag
                          color={getPriorityColor(item.WorkRequest.priority)}
                          style={{ margin: 0 }}
                        >
                          {getPriorityLabel(item.WorkRequest.priority)}
                        </Tag>
                        <Tag
                          color={getWorkRequestStatusColor(item.WorkRequest.status)}
                          style={{ margin: 0 }}
                        >
                          {getWorkRequestStatusLabel(item.WorkRequest.status)}
                        </Tag>
                        {item.WorkRequest.Requester && (
                          <span style={{ fontSize: 13, color: '#595959' }}>
                            요청자: {item.WorkRequest.Requester.displayName}
                          </span>
                        )}
                        {item.WorkRequest.Assignee && (
                          <span style={{ fontSize: 13, color: '#595959' }}>
                            담당자: {item.WorkRequest.Assignee.displayName}
                          </span>
                        )}
                      </Space>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
                      <ArrowRightOutlined style={{ fontSize: 18, color: '#8c8c8c' }} />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* 하위 항목 리스트 */}
            {item.type !== 'ACTION' && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 8 }}>
                  하위 {
                    item.type === 'PROJECT' ? '서비스' :
                    item.type === 'SERVICE' ? '액션' :  // 3단계 구조: 서비스 → 액션
                    item.type === 'TEAM' ? '액션' : '항목'
                  } ({item.children?.length || 0})
                </div>
                {item.children && item.children.length > 0 ? (
                  <div style={{
                    border: '1px solid #f0f0f0',
                    borderRadius: '4px',
                    overflow: 'hidden'
                  }}>
                    {/* 서비스인 경우 팀별로 그룹화해서 표시 */}
                    {item.type === 'SERVICE' ? (() => {
                      // 팀별로 액션 그룹화
                      const groupedByTeam = item.children!.reduce((acc, child) => {
                        const teamName = child.User_Item_createdByIdToUser?.Team?.name || '미배정';
                        if (!acc[teamName]) {
                          acc[teamName] = [];
                        }
                        acc[teamName].push(child);
                        return acc;
                      }, {} as Record<string, Item[]>);

                      // 팀 이름 정렬 (미배정은 맨 뒤로)
                      const sortedTeams = Object.keys(groupedByTeam).sort((a, b) => {
                        if (a === '미배정') return 1;
                        if (b === '미배정') return -1;
                        return a.localeCompare(b, 'ko');
                      });

                      return sortedTeams.map((teamName, teamIndex) => (
                        <div key={teamName}>
                          {/* 팀 헤더 */}
                          <div style={{
                            padding: '8px 12px',
                            backgroundColor: '#f6ffed',
                            borderBottom: '1px solid #b7eb8f',
                            borderTop: teamIndex > 0 ? '1px solid #f0f0f0' : 'none',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                          }}>
                            <Tag color="green" style={{ margin: 0, fontSize: '11px' }}>
                              T
                            </Tag>
                            <span style={{ fontWeight: 600, color: '#52c41a', fontSize: '13px' }}>
                              {teamName}
                            </span>
                            <span style={{ color: '#8c8c8c', fontSize: '12px' }}>
                              ({groupedByTeam[teamName].length}개 액션)
                            </span>
                          </div>
                          {/* 해당 팀의 액션 목록 */}
                          {groupedByTeam[teamName].map((child, index) => (
                            <div
                              key={child.id}
                              style={{
                                padding: '10px 12px 10px 24px',
                                borderBottom: index < groupedByTeam[teamName].length - 1 ? '1px solid #f0f0f0' : 'none',
                                cursor: 'pointer',
                                transition: 'background-color 0.2s',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                gap: '16px',
                              }}
                              onClick={() => handleChildItemClick(child)}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor = '#fafafa';
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor = 'transparent';
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                                <Tag
                                  color="orange"
                                  style={{ margin: 0, fontSize: '11px', padding: '2px 6px' }}
                                >
                                  {typeLabels[child.type as keyof typeof typeLabels]}
                                </Tag>
                                <Tag
                                  color={
                                    child.status === 'COMPLETED' ? 'success' :
                                    child.status === 'IN_PROGRESS' ? 'processing' :
                                    child.status === 'ON_HOLD' ? 'warning' : 'default'
                                  }
                                  style={{ margin: 0, fontSize: '11px' }}
                                >
                                  {statusLabels[child.status as keyof typeof statusLabels]}
                                </Tag>
                                <div style={{ fontWeight: 500 }}>{child.name}</div>
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div style={{ fontSize: '12px', color: '#595959', minWidth: '80px', textAlign: 'right' }}>
                                  {child.User_Item_assigneeIdToUser?.displayName || '-'}
                                </div>
                                <div style={{ fontSize: '12px', color: '#595959', minWidth: '150px', textAlign: 'right' }}>
                                  {child.startDate && child.endDate
                                    ? `${new Date(child.startDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} ~ ${new Date(child.endDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`
                                    : '기간 미정'}
                                </div>
                                <Progress
                                  type="circle"
                                  percent={child.progress || 0}
                                  size={40}
                                  strokeWidth={6}
                                  format={(percent) => (
                                    <span style={{ fontSize: '10px', fontWeight: 600 }}>
                                      {percent}%
                                    </span>
                                  )}
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      ));
                    })() : (
                      /* 서비스가 아닌 경우 기존 방식대로 표시 */
                      item.children.map((child, index) => (
                        <div
                          key={child.id}
                          style={{
                            padding: '10px 12px',
                            borderBottom: index < item.children!.length - 1 ? '1px solid #f0f0f0' : 'none',
                            cursor: 'pointer',
                            transition: 'background-color 0.2s',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            gap: '16px',
                          }}
                          onClick={() => handleChildItemClick(child)}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.backgroundColor = '#fafafa';
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.backgroundColor = 'transparent';
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: 1, minWidth: 0 }}>
                            <Tag
                              color={
                                child.type === 'PROJECT' ? 'purple' :
                                child.type === 'SERVICE' ? 'blue' :
                                child.type === 'TEAM' ? 'green' : 'orange'
                              }
                              style={{ margin: 0, fontSize: '11px', padding: '2px 6px' }}
                            >
                              {typeLabels[child.type as keyof typeof typeLabels]}
                            </Tag>
                            <Tag
                              color={
                                child.status === 'COMPLETED' ? 'success' :
                                child.status === 'IN_PROGRESS' ? 'processing' :
                                child.status === 'ON_HOLD' ? 'warning' : 'default'
                              }
                              style={{ margin: 0, fontSize: '11px' }}
                            >
                              {statusLabels[child.status as keyof typeof statusLabels]}
                            </Tag>
                            <div style={{ fontWeight: 500 }}>{child.name}</div>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ fontSize: '12px', color: '#595959', minWidth: '80px', textAlign: 'right' }}>
                              {child.User_Item_assigneeIdToUser?.displayName || '-'}
                            </div>
                            <div style={{ fontSize: '12px', color: '#595959', minWidth: '150px', textAlign: 'right' }}>
                              {child.startDate && child.endDate
                                ? `${new Date(child.startDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })} ~ ${new Date(child.endDate).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' })}`
                                : '기간 미정'}
                            </div>
                            <Progress
                              type="circle"
                              percent={child.progress || 0}
                              size={40}
                              strokeWidth={6}
                              format={(percent) => (
                                <span style={{ fontSize: '10px', fontWeight: 600 }}>
                                  {percent}%
                                </span>
                              )}
                            />
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                ) : (
                  <div style={{
                    padding: '20px',
                    textAlign: 'center',
                    color: '#bfbfbf',
                    fontStyle: 'italic',
                    backgroundColor: '#fafafa',
                    borderRadius: '4px'
                  }}>
                    하위 항목이 없습니다.
                  </div>
                )}
              </div>
            )}

            {/* 관련 문서 섹션 */}
            <div>
              <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 8 }}>
                관련 문서 (하위 항목 포함) ({relatedDocs.length})
              </div>
              {relatedDocs.length > 0 ? (
                <List
                  style={{
                    maxHeight: '400px',
                    overflow: 'auto',
                    border: '1px solid #f0f0f0',
                    borderRadius: '4px'
                  }}
                  size="small"
                  dataSource={relatedDocs}
                  renderItem={(doc) => {
                    const isFile = doc.type === 'file';
                    const data = doc.data as any;
                    const canDelete = user?.role === 'ADMIN' || user?.id === (isFile ? data.uploadedById : data.createdById);

                    // 3단계 구조에서 PSTA 정보 추출
                    const getPSTAInfo = () => {
                      const info: { project?: string; service?: string; team?: string; action?: string } = {};
                      const itemData = data.Item;
                      if (!itemData) return info;

                      // 팀은 업로더/생성자의 팀에서 가져옴
                      const uploaderTeam = isFile ? data.UploadedBy?.Team?.name : data.CreatedBy?.Team?.name;
                      if (uploaderTeam) info.team = uploaderTeam;

                      switch (itemData.type) {
                        case 'PROJECT':
                          info.project = itemData.name;
                          break;
                        case 'SERVICE':
                          info.service = itemData.name;
                          if (itemData.Item) info.project = itemData.Item.name;
                          break;
                        case 'ACTION':
                          info.action = itemData.name;
                          if (itemData.Item) {
                            info.service = itemData.Item.name;
                            if (itemData.Item.Item) info.project = itemData.Item.Item.name;
                          }
                          break;
                      }
                      return info;
                    };
                    const pstaInfo = getPSTAInfo();

                    return (
                      <List.Item
                        style={{ padding: '10px 12px' }}
                        actions={[
                          isFile ? (
                            <Button
                              type="link"
                              size="small"
                              icon={<DownloadOutlined />}
                              href={filesApi.getFileUrl(data.filename)}
                              target="_blank"
                            >
                              다운로드
                            </Button>
                          ) : (
                            <Button
                              type="link"
                              size="small"
                              icon={<LinkOutlined />}
                              href={data.url}
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              열기
                            </Button>
                          ),
                          canDelete && (
                            <Popconfirm
                              title={isFile ? "파일 삭제" : "링크 삭제"}
                              description={`이 ${isFile ? '파일' : '링크'}을 삭제하시겠습니까?`}
                              onConfirm={() => handleDeleteRelatedDoc(doc.type, data.id)}
                              okText="삭제"
                              cancelText="취소"
                            >
                              <Button
                                type="link"
                                size="small"
                                danger
                                icon={<DeleteOutlined />}
                              >
                                삭제
                              </Button>
                            </Popconfirm>
                          ),
                        ].filter(Boolean)}
                      >
                        <div style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                          {/* 첫째 줄: 문서명 + 구분태그 + 이름/날짜 */}
                          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
                            <Space size={8}>
                              {isFile ? (
                                <FileOutlined style={{ fontSize: 16, color: '#1890ff' }} />
                              ) : (
                                <LinkOutlined style={{ fontSize: 16, color: '#52c41a' }} />
                              )}
                              <span style={{ fontWeight: 500 }}>{isFile ? data.originalName : data.displayName}</span>
                              <Tag color={isFile ? 'blue' : 'green'} style={{ margin: 0, fontSize: 11 }}>
                                {isFile ? '파일' : '링크'}
                              </Tag>
                              {isFile && data.filesize && (
                                <span style={{ fontSize: 11, color: '#8c8c8c' }}>{formatFileSize(data.filesize)}</span>
                              )}
                              <span style={{ color: '#8c8c8c' }}>•</span>
                              <span style={{ fontSize: 12, color: '#595959' }}>{isFile ? data.UploadedBy?.displayName : data.CreatedBy?.displayName || '알 수 없음'}</span>
                              <span style={{ color: '#8c8c8c' }}>•</span>
                              <span style={{ fontSize: 12, color: '#595959' }}>{new Date(data.createdAt).toLocaleDateString('ko-KR')}</span>
                            </Space>
                          </div>
                          {/* 둘째 줄: PSTA 태그 */}
                          <div style={{ marginLeft: 24 }}>
                            <Space size={4} wrap>
                              {pstaInfo.project && (
                                <Tag color="#722ed1" style={{ margin: 0, fontSize: 10 }}>P: {pstaInfo.project}</Tag>
                              )}
                              {pstaInfo.service && (
                                <Tag color="#1890ff" style={{ margin: 0, fontSize: 10 }}>S: {pstaInfo.service}</Tag>
                              )}
                              {pstaInfo.team && (
                                <Tag color="#52c41a" style={{ margin: 0, fontSize: 10 }}>T: {pstaInfo.team}</Tag>
                              )}
                              {pstaInfo.action && (
                                <Tag color="#fa8c16" style={{ margin: 0, fontSize: 10 }}>A: {pstaInfo.action}</Tag>
                              )}
                            </Space>
                          </div>
                        </div>
                      </List.Item>
                    );
                  }}
                />
              ) : (
                <div style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#bfbfbf',
                  fontStyle: 'italic',
                  backgroundColor: '#fafafa',
                  borderRadius: '4px'
                }}>
                  관련된 문서가 없습니다
                </div>
              )}
            </div>
          </div>

          {/* 오른쪽 영역 (30%) - 댓글 */}
          <div style={{
            flex: '0 0 30%',
            borderLeft: '1px solid #f0f0f0',
            paddingLeft: '24px',
            paddingRight: '24px',
            display: 'flex',
            flexDirection: 'column',
            height: '100%'
          }}>
            <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 12, fontWeight: 600 }}>
              댓글 ({comments.length})
            </div>

            {/* 댓글 리스트 */}
            <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12 }}>
              {comments.length > 0 ? (
                <List
                  dataSource={comments}
                  renderItem={(comment) => (
                    <List.Item
                      key={comment.id}
                      style={{ padding: '8px 0', borderBottom: '1px solid #f0f0f0' }}
                    >
                      <List.Item.Meta
                        avatar={
                          <Avatar icon={<UserOutlined />} size="small" />
                        }
                        title={
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1 }}>
                              <span style={{ fontSize: '12px', fontWeight: 600 }}>
                                {comment.User?.displayName || '알 수 없음'}
                              </span>
                              {/* 이모티콘 반응 */}
                              <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                {(() => {
                                  const emojiConfig = [
                                    { emoji: '✅', name: '확인' },
                                    { emoji: '❤️', name: '좋아' },
                                    { emoji: '👍', name: '최고' },
                                    { emoji: '😊', name: '개웃김' },
                                    { emoji: '😠', name: '빡침' },
                                  ];

                                  try {
                                    const reactions: { [key: string]: string[] } = comment.reactions ? JSON.parse(comment.reactions) : {};
                                    const reactionsWithUsers: { [key: string]: Array<{userId: string, displayName: string}> } =
                                      comment.reactionsWithUsers ? JSON.parse(comment.reactionsWithUsers) : {};

                                    return (
                                      <>
                                        {emojiConfig.map(({ emoji, name }) => {
                                          const userIds = reactions[emoji];
                                          if (!userIds || userIds.length === 0) return null;

                                          const usersWhoReacted = reactionsWithUsers[emoji] || [];
                                          const userNames = usersWhoReacted.length > 0
                                            ? usersWhoReacted.map(u => u.displayName).join(', ')
                                            : userIds.map(id => id.substring(0, 8)).join(', ');

                                          const tooltipContent = `${name}: ${userNames}`;

                                          return (
                                            <Tooltip key={emoji} title={tooltipContent} placement="top">
                                              <button
                                                onClick={() => handleReactionToggle(comment.id, emoji)}
                                                style={{
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  gap: 2,
                                                  padding: 0,
                                                  border: 'none',
                                                  background: 'transparent',
                                                  cursor: 'pointer',
                                                  fontSize: '12px',
                                                  transition: 'all 0.2s',
                                                  opacity: userIds.includes(user?.id || '') ? 1 : 0.6,
                                                }}
                                                onMouseEnter={(e) => {
                                                  e.currentTarget.style.transform = 'scale(1.2)';
                                                }}
                                                onMouseLeave={(e) => {
                                                  e.currentTarget.style.transform = 'scale(1)';
                                                }}
                                              >
                                                <span>{emoji}</span>
                                                <span style={{ fontSize: '10px', color: '#595959' }}>
                                                  {userIds.length}
                                                </span>
                                              </button>
                                            </Tooltip>
                                          );
                                        })}

                                        {emojiConfig.map(({ emoji, name }) => {
                                          const userIds = reactions[emoji];
                                          if (userIds && userIds.length > 0) return null;

                                          return (
                                            <Tooltip key={emoji} title={name} placement="top">
                                              <button
                                                onClick={() => handleReactionToggle(comment.id, emoji)}
                                                style={{
                                                  display: 'flex',
                                                  alignItems: 'center',
                                                  padding: 0,
                                                  border: 'none',
                                                  background: 'transparent',
                                                  cursor: 'pointer',
                                                  fontSize: '12px',
                                                  opacity: 0.3,
                                                  transition: 'all 0.2s',
                                                }}
                                                onMouseEnter={(e) => {
                                                  e.currentTarget.style.opacity = '1';
                                                  e.currentTarget.style.transform = 'scale(1.2)';
                                                }}
                                                onMouseLeave={(e) => {
                                                  e.currentTarget.style.opacity = '0.3';
                                                  e.currentTarget.style.transform = 'scale(1)';
                                                }}
                                              >
                                                {emoji}
                                              </button>
                                            </Tooltip>
                                          );
                                        })}
                                      </>
                                    );
                                  } catch (error) {
                                    return null;
                                  }
                                })()}
                              </div>
                            </div>
                            {comment.userId === user?.id && (
                              <Button
                                type="text"
                                size="small"
                                icon={<DeleteOutlined />}
                                onClick={() => handleDeleteComment(comment.id)}
                                style={{ fontSize: '12px', color: '#ff4d4f' }}
                              />
                            )}
                          </div>
                        }
                        description={
                          <div style={{ fontSize: '13px' }}>
                            <div style={{ marginBottom: 4, whiteSpace: 'pre-wrap', color: '#262626', lineHeight: '1.6' }}>
                              {renderCommentContent(comment.content)}
                            </div>
                            <div style={{ fontSize: '11px', color: '#8c8c8c' }}>
                              {new Date(comment.createdAt).toLocaleString('ko-KR')}
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <div style={{
                  padding: '20px',
                  textAlign: 'center',
                  color: '#bfbfbf',
                  fontStyle: 'italic',
                  fontSize: '12px'
                }}>
                  댓글이 없습니다.
                </div>
              )}
            </div>

            {/* 댓글 입력 */}
            <div>
              <div style={{ position: 'relative', marginBottom: 8 }}>
                <Mentions
                  value={commentContent}
                  onChange={setCommentContent}
                  placeholder="댓글을 입력하세요... (@로 사용자 멘션)"
                  rows={3}
                  style={{ fontSize: '13px' }}
                  prefix="@"
                  options={users.map(u => ({
                    value: `[${u.displayName}](${u.id})`,
                    label: (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Avatar size="small" icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
                        <div>
                          <div style={{ fontWeight: 500 }}>{u.displayName}</div>
                          <div style={{ fontSize: 11, color: '#8c8c8c' }}>@{u.username}</div>
                        </div>
                      </div>
                    ),
                  }))}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleAddComment();
                    }
                  }}
                />
                <Popover
                  content={
                    <EmojiPicker
                      onEmojiClick={handleEmojiClick}
                      width={300}
                      height={350}
                    />
                  }
                  trigger="click"
                  open={showEmojiPicker}
                  onOpenChange={setShowEmojiPicker}
                  placement="topRight"
                >
                  <Button
                    icon={<SmileOutlined />}
                    size="small"
                    style={{
                      position: 'absolute',
                      right: 8,
                      top: 8,
                      zIndex: 1000,
                      borderColor: '#ffd666',
                      color: '#faad14',
                      backgroundColor: '#fffbe6',
                      fontWeight: 500,
                    }}
                  >
                    이모지
                  </Button>
                </Popover>
              </div>
              <Button
                type="primary"
                icon={<SendOutlined />}
                onClick={handleAddComment}
                disabled={!commentContent.trim()}
                block
              >
                댓글 추가
              </Button>
            </div>
          </div>
        </div>
      </div>
      )}
    </div>
  );
};
