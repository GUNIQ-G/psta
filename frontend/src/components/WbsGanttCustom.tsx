import React, { useState, useEffect } from 'react';
import { Select, Spin, Button, Space, Table, Tag, Progress, Avatar, DatePicker, message, Typography, Tooltip, Popconfirm, List, Divider, Mentions, Popover } from 'antd';
import { UserOutlined, EditOutlined, DeleteOutlined, CloseOutlined, SendOutlined, SmileOutlined, FileOutlined, LinkOutlined, FileTextOutlined, ArrowRightOutlined, DownloadOutlined } from '@ant-design/icons';
import type { ColumnType } from 'antd/es/table';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { useNavigate } from 'react-router-dom';
import dayjs, { Dayjs } from 'dayjs';
import { Item, ItemType, ItemStatus, Comment, FileAttachment, Link, WorkRequestPriority, WorkRequestStatus } from '../types';
import { itemsApi } from '../api/items';
import { clientsApi } from '../api/clients';
import { userApi } from '../api/user';
import { commentsApi } from '../api/comments';
import { filesApi } from '../api/files';
import { linksApi } from '../api/links';
import { useAuthStore } from '../store/authStore';
import './TiptapEditor.css';

const { RangePicker } = DatePicker;

// Type color mapping
const TYPE_COLORS: Record<ItemType, string> = {
  PROJECT: '#722ed1',  // purple
  SERVICE: '#1890ff',  // blue
  TEAM: '#52c41a',     // green
  ACTION: '#fa8c16',   // orange
};

const TYPE_LABELS: Record<ItemType, string> = {
  PROJECT: 'P',
  SERVICE: 'S',
  TEAM: 'T',
  ACTION: 'A',
};

const STATUS_LABELS: Record<ItemStatus, string> = {
  NOT_STARTED: '시작 전',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '보류',
};

const STATUS_COLORS: Record<ItemStatus, string> = {
  NOT_STARTED: 'default',
  IN_PROGRESS: 'blue',
  COMPLETED: 'green',
  ON_HOLD: 'orange',
};

const typeLabels = {
  PROJECT: 'Project',
  SERVICE: 'Service',
  TEAM: 'Team',
  ACTION: 'Action',
};

const statusLabels = {
  NOT_STARTED: '시작 전',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '보류',
};

interface TimelineDay {
  date: string;
  isWeekend: boolean;
}

// Generate timeline for a given month range
const generateTimeline = (startDate: dayjs.Dayjs, months: number = 3): TimelineDay[] => {
  const timeline: TimelineDay[] = [];
  const endDate = startDate.add(months, 'month');

  let current = startDate.startOf('month');
  while (current.isBefore(endDate)) {
    timeline.push({
      date: current.format('YYYY-MM-DD'),
      isWeekend: current.day() === 0 || current.day() === 6,
    });
    current = current.add(1, 'day');
  }

  return timeline;
};

// Calculate position and width for timeline bar
const calculateBarPosition = (
  itemStart: string | undefined,
  itemEnd: string | undefined,
  timelineStart: dayjs.Dayjs,
  timelineEnd: dayjs.Dayjs,
  totalWidth: number
): { left: number; width: number } | null => {
  if (!itemStart || !itemEnd) return null;

  const start = dayjs(itemStart);
  const end = dayjs(itemEnd);

  if (end.isBefore(timelineStart) || start.isAfter(timelineEnd)) {
    return null; // Out of visible range
  }

  const clampedStart = start.isBefore(timelineStart) ? timelineStart : start;
  const clampedEnd = end.isAfter(timelineEnd) ? timelineEnd : end;

  const totalDays = timelineEnd.diff(timelineStart, 'day');
  const startOffset = clampedStart.diff(timelineStart, 'day');
  const duration = clampedEnd.diff(clampedStart, 'day') + 1;

  const left = (startOffset / totalDays) * totalWidth;
  const width = (duration / totalDays) * totalWidth;

  return { left, width };
};

export const WbsGanttCustom: React.FC = () => {
  const navigate = useNavigate();
  const [items, setItems] = useState<Item[]>([]);
  const [allItems, setAllItems] = useState<Item[]>([]); // Store all items for filtering
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [selectedClientId, setSelectedClientId] = useState<string>();
  const [loading, setLoading] = useState(false);

  // Item detail state (like PstaSchedule)
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [relatedDocs, setRelatedDocs] = useState<Array<{ type: 'file' | 'link', data: FileAttachment | Link }>>([]);
  const user = useAuthStore((state) => state.user);

  // Filters
  const [selectedProjects, setSelectedProjects] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);

  // Default: 3 months (1.5 months before and after today)
  const [timelineStart, setTimelineStart] = useState(dayjs().subtract(1.5, 'month').startOf('day'));
  const [timelineEnd, setTimelineEnd] = useState(dayjs().add(1.5, 'month').endOf('day'));
  const [dateRange, setDateRange] = useState<[Dayjs, Dayjs]>([
    dayjs().subtract(1.5, 'month').startOf('day'),
    dayjs().add(1.5, 'month').endOf('day')
  ]);

  useEffect(() => {
    fetchClients();
    fetchUsers();
  }, []);

  useEffect(() => {
    if (selectedClientId) {
      fetchItems();
    }
  }, [selectedClientId]);

  const fetchClients = async () => {
    try {
      const data = await clientsApi.getClients();
      setClients(data);
      // Auto-select first client if available
      if (data.length > 0 && !selectedClientId) {
        setSelectedClientId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to fetch clients:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      const data = await userApi.getAll();
      setUsers(data);
    } catch (error) {
      console.error('Failed to fetch users:', error);
    }
  };

  const fetchItems = async () => {
    setLoading(true);
    try {
      const data = await itemsApi.getItemTree(selectedClientId);
      setAllItems(data);
      setItems(data);
      // Reset filters when fetching new data
      setSelectedProjects([]);
      setSelectedTeams([]);
    } catch (error) {
      console.error('Failed to fetch items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleItemClick = async (item: Item) => {
    try {
      const fullItem = await itemsApi.getItemById(item.id);
      setSelectedItem(fullItem);
      setCommentContent('');
      await fetchComments(item.id);
      await loadRelatedDocuments(item.id);
    } catch (error) {
      console.error('Failed to load item:', error);
      setSelectedItem(item);
      await fetchComments(item.id);
      await loadRelatedDocuments(item.id);
    }
  };

  const handleCloseDetail = () => {
    setSelectedItem(null);
    setComments([]);
    setCommentContent('');
    setRelatedDocs([]);
  };

  const handleDelete = async (id: string) => {
    try {
      await itemsApi.deleteItem(id);
      message.success('항목이 삭제되었습니다');
      setSelectedItem(null);
      fetchItems();
    } catch (error: any) {
      message.error('삭제 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const fetchComments = async (itemId: string) => {
    try {
      const data = await commentsApi.getCommentsByItem(itemId);
      setComments(data);
    } catch (error) {
      console.error('Failed to fetch comments:', error);
    }
  };

  const handleAddComment = async () => {
    if (!selectedItem || !commentContent.trim()) return;

    try {
      await commentsApi.createComment(selectedItem.id, commentContent.trim());
      setCommentContent('');
      await fetchComments(selectedItem.id);
      message.success('댓글이 추가되었습니다');
    } catch (error: any) {
      message.error('댓글 추가 실패: ' + error.message);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!selectedItem) return;

    try {
      await commentsApi.deleteComment(commentId);
      await fetchComments(selectedItem.id);
      message.success('댓글이 삭제되었습니다');
    } catch (error: any) {
      message.error('댓글 삭제 실패: ' + error.message);
    }
  };

  const handleEmojiClick = (emojiData: EmojiClickData) => {
    setCommentContent(prev => prev + emojiData.emoji);
    setShowEmojiPicker(false);
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

  const handleDeleteRelatedDoc = async (docType: 'file' | 'link', docId: string) => {
    try {
      if (docType === 'file') {
        await filesApi.deleteFile(docId);
        message.success('파일이 삭제되었습니다.');
      } else {
        await linksApi.deleteLink(docId);
        message.success('링크가 삭제되었습니다.');
      }
      if (selectedItem) {
        await loadRelatedDocuments(selectedItem.id);
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || `${docType === 'file' ? '파일' : '링크'} 삭제에 실패했습니다.`);
    }
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
    setSelectedItem(null);
    navigate(`/requests?workRequestId=${workRequestId}`);
  };

  // Apply filters
  useEffect(() => {
    if (allItems.length === 0) return;

    let filtered = [...allItems];

    // Filter by projects
    if (selectedProjects.length > 0) {
      filtered = filtered.filter(item => selectedProjects.includes(item.name));
    }

    // Filter by teams (filter services that have selected teams)
    if (selectedTeams.length > 0) {
      filtered = filtered.map(project => {
        const filteredServices = project.children?.filter(service => {
          return service.children?.some(team => selectedTeams.includes(team.name));
        }).map(service => {
          return {
            ...service,
            children: service.children?.filter(team => selectedTeams.includes(team.name))
          };
        });

        return {
          ...project,
          children: filteredServices
        };
      });
    }

    setItems(filtered);
  }, [selectedProjects, selectedTeams, allItems]);

  // Extract unique projects
  const uniqueProjects = allItems.map(item => ({
    value: item.name,
    label: item.name
  }));

  // Extract unique teams
  const uniqueTeams = Array.from(
    new Set(
      allItems.flatMap(project =>
        project.children?.flatMap(service =>
          service.children?.map(team => team.name) || []
        ) || []
      )
    )
  ).map(team => ({
    value: team,
    label: team
  }));

  const timelineWidth = 800; // Fixed width for timeline

  // Quick date range buttons
  const setQuickRange = (months: number) => {
    const halfMonths = months / 2;
    const start = dayjs().subtract(halfMonths, 'month').startOf('day');
    const end = dayjs().add(halfMonths, 'month').endOf('day');
    setTimelineStart(start);
    setTimelineEnd(end);
    setDateRange([start, end]);
  };

  const handleDateRangeChange = (dates: any) => {
    if (dates && dates[0] && dates[1]) {
      setTimelineStart(dates[0].startOf('day'));
      setTimelineEnd(dates[1].endOf('day'));
      setDateRange([dates[0], dates[1]]);
    }
  };

  // Flatten tree structure for table display
  const flattenItems = (items: Item[], level = 0): any[] => {
    const result: any[] = [];
    items.forEach((item) => {
      const childrenCount = item.children?.length || 0;
      result.push({ ...item, level, childrenCount });
      if (item.children && item.children.length > 0) {
        result.push(...flattenItems(item.children, level + 1));
      }
    });
    return result;
  };

  const flatItems = flattenItems(items);

  // Generate month headers based on the date range
  const monthHeaders = [];
  let current = timelineStart.startOf('month');
  const endMonth = timelineEnd.endOf('month');

  while (current.isBefore(endMonth) || current.isSame(endMonth, 'month')) {
    const daysInMonth = current.daysInMonth();
    const totalDays = timelineEnd.diff(timelineStart, 'day');
    monthHeaders.push({
      month: current.format('YYYY년 M월'),
      days: daysInMonth,
      width: (daysInMonth / totalDays) * timelineWidth,
    });
    current = current.add(1, 'month');
  }

  const columns: ColumnType<any>[] = [
    {
      title: 'PSTA 업무명',
      dataIndex: 'name',
      key: 'name',
      width: 450,
      fixed: 'left',
      render: (name: string, record: any) => (
        <div style={{ paddingLeft: record.level * 20, display: 'flex', alignItems: 'center', gap: 6 }}>
          <Tag color={TYPE_COLORS[record.type]} style={{ margin: 0, fontSize: 10, padding: '0 4px', minWidth: 16, textAlign: 'center' }}>
            {TYPE_LABELS[record.type]}
          </Tag>
          <span style={{ fontWeight: record.level === 0 ? 600 : 400 }}>
            {name}
            {record.childrenCount > 0 && (
              <span style={{ color: '#8c8c8c', fontSize: 11, marginLeft: 4 }}>
                ({record.childrenCount})
              </span>
            )}
          </span>
          <Tag color={STATUS_COLORS[record.status]} style={{ margin: 0, fontSize: 10, padding: '0 6px' }}>
            {STATUS_LABELS[record.status]}
          </Tag>
        </div>
      ),
    },
    {
      title: '담당자',
      key: 'assignee',
      width: 80,
      render: (_, record: any) => {
        const assignee = record.User_Item_assigneeIdToUser;
        return (
          <span style={{ fontSize: 12 }}>
            {assignee?.displayName || '-'}
          </span>
        );
      },
    },
    {
      title: '진행률',
      dataIndex: 'progress',
      key: 'progress',
      width: 80,
      align: 'center',
      render: (progress: number) => (
        <Progress
          type="circle"
          percent={progress}
          size={40}
          strokeWidth={8}
          format={(percent) => (
            <span style={{ fontSize: '10px', fontWeight: 600 }}>
              {percent}%
            </span>
          )}
        />
      ),
    },
    {
      title: '기간',
      key: 'period',
      width: 200,
      render: (_, record: Item) => {
        if (!record.startDate || !record.endDate) return '-';
        return (
          <div style={{ fontSize: 12 }}>
            {dayjs(record.startDate).format('YYYY-MM-DD')} ~ {dayjs(record.endDate).format('YYYY-MM-DD')}
          </div>
        );
      },
    },
    {
      title: (
        <div style={{ width: timelineWidth, overflow: 'hidden' }}>
          <div style={{ display: 'flex', borderBottom: '1px solid #f0f0f0' }}>
            {monthHeaders.map((month, idx) => (
              <div
                key={idx}
                style={{
                  width: month.width,
                  textAlign: 'center',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: '4px 0',
                  borderRight: idx < monthHeaders.length - 1 ? '1px solid #f0f0f0' : 'none',
                }}
              >
                {month.month}
              </div>
            ))}
          </div>
        </div>
      ),
      key: 'timeline',
      width: timelineWidth,
      render: (_, record: Item) => {
        const barPosition = calculateBarPosition(
          record.startDate,
          record.endDate,
          timelineStart,
          timelineEnd,
          timelineWidth
        );

        return (
          <div style={{ width: timelineWidth, height: 30, position: 'relative', background: '#fafafa' }}>
            {/* Timeline grid lines */}
            {monthHeaders.map((month, idx) => {
              const left = monthHeaders.slice(0, idx).reduce((sum, m) => sum + m.width, 0);
              return (
                <div
                  key={idx}
                  style={{
                    position: 'absolute',
                    left: left,
                    top: 0,
                    height: '100%',
                    borderLeft: '1px solid #e8e8e8',
                  }}
                />
              );
            })}

            {barPosition && (
              <div
                style={{
                  position: 'absolute',
                  left: barPosition.left,
                  top: 6,
                  width: barPosition.width,
                  height: 18,
                  background: TYPE_COLORS[record.type],
                  borderRadius: 3,
                  opacity: 0.8,
                }}
              />
            )}
          </div>
        );
      },
    },
  ];

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Item Detail Panel - Top (like PstaSchedule) */}
      <div
        style={{
          flex: selectedItem ? '0 0 50%' : '0 0 0%',
          overflow: 'hidden',
          transition: 'flex 0.3s ease-in-out',
          marginBottom: selectedItem ? 16 : 0,
          backgroundColor: '#fff',
          border: selectedItem ? '1px solid #d9d9d9' : 'none',
          borderRadius: '6px',
          position: 'relative',
        }}
      >
        {selectedItem && (
          <div style={{ padding: '20px', height: '100%', overflowY: 'auto' }}>
            {/* 헤더 영역 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: 24 }}>
              {/* 좌측: PSTA 구분 + 상태 */}
              <div style={{ display: 'flex', gap: '6px' }}>
                <Tag color={
                  selectedItem.type === 'PROJECT' ? 'purple' :
                  selectedItem.type === 'SERVICE' ? 'blue' :
                  selectedItem.type === 'TEAM' ? 'green' : 'orange'
                } style={{ fontSize: '12px', padding: '2px 8px', margin: 0 }}>
                  {typeLabels[selectedItem.type as keyof typeof typeLabels]}
                </Tag>
                <Tag color={
                  selectedItem.status === 'COMPLETED' ? 'success' :
                  selectedItem.status === 'IN_PROGRESS' ? 'processing' :
                  selectedItem.status === 'ON_HOLD' ? 'warning' : 'default'
                } style={{ fontSize: '12px', padding: '2px 8px', margin: 0 }}>
                  {statusLabels[selectedItem.status as keyof typeof statusLabels]}
                </Tag>
              </div>

              {/* 중앙: 제목 (50% 이상) */}
              <div style={{ flex: '1 1 50%', minWidth: 0 }}>
                <Typography.Title level={4} style={{ margin: 0, wordBreak: 'break-word' }}>
                  {selectedItem.name}
                </Typography.Title>
              </div>

              {/* 우측: 기간 + 진행률 + 수정/삭제/닫기 버튼 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div style={{ fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                  {selectedItem.startDate && selectedItem.endDate ? (
                    <>
                      {new Date(selectedItem.startDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                      {' → '}
                      {new Date(selectedItem.endDate).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </>
                  ) : '기간 미정'}
                </div>
                <Progress
                  type="circle"
                  percent={selectedItem.progress || 0}
                  size={50}
                  strokeWidth={8}
                />
                <Space>
                  {(() => {
                    const isTeam = selectedItem.type === 'TEAM';
                    const canModify = user?.role === 'ADMIN' || selectedItem.createdById === user?.id;
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
                          type="text"
                          disabled={isDisabled}
                        />
                      </Tooltip>
                    );
                  })()}

                  {(() => {
                    const hasChildren = selectedItem.children && selectedItem.children.length > 0;
                    const canModify = user?.role === 'ADMIN' || selectedItem.createdById === user?.id;
                    const isDisabled = hasChildren || !canModify;
                    const tooltipText = hasChildren
                      ? '하위 항목이 있어 삭제할 수 없습니다'
                      : !canModify
                      ? '생성자 또는 최고관리자만 삭제할 수 있습니다'
                      : '';

                    return (
                      <Popconfirm
                        title="항목 삭제"
                        description="정말 삭제하시겠습니까?"
                        onConfirm={() => handleDelete(selectedItem.id)}
                        okText="삭제"
                        cancelText="취소"
                        disabled={isDisabled}
                      >
                        <Tooltip title={tooltipText}>
                          <Button
                            icon={<DeleteOutlined />}
                            type="text"
                            danger
                            disabled={isDisabled}
                          />
                        </Tooltip>
                      </Popconfirm>
                    );
                  })()}

                  <Button
                    icon={<CloseOutlined />}
                    onClick={handleCloseDetail}
                    type="text"
                  />
                </Space>
              </div>
            </div>

            {/* 본문 영역 (70% 정보 / 30% 댓글) */}
            <div style={{ display: 'flex', gap: '24px', height: 'calc(100% - 80px)' }}>
              {/* 좌측 70%: 항목 정보 + 하위 항목 + 관련 문서 */}
              <div style={{ flex: '0 0 70%', overflowY: 'auto', paddingRight: '12px' }}>
                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 4 }}>담당자</div>
                  <div style={{ fontWeight: 500 }}>{selectedItem.User_Item_assigneeIdToUser?.displayName || '-'}</div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 4 }}>설명</div>
                  <div style={{ padding: '12px', backgroundColor: '#fafafa', borderRadius: '4px' }}>
                    {selectedItem.description ? (
                      <div
                        className="description-html-view"
                        dangerouslySetInnerHTML={{ __html: selectedItem.description }}
                      />
                    ) : (
                      <span style={{ color: '#bfbfbf', fontStyle: 'italic' }}>등록된 설명이 없습니다.</span>
                    )}
                  </div>
                </div>

                {/* 연결된 작업 요청 - ACTION 타입이고 WorkRequest가 있을 때만 표시 */}
                {selectedItem.type === 'ACTION' && selectedItem.WorkRequest && (
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
                      onClick={() => handleGoToWorkRequest(selectedItem.WorkRequest!.id)}
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
                            {selectedItem.WorkRequest.title}
                          </div>
                          <Space size={8} wrap>
                            <Tag
                              color={getPriorityColor(selectedItem.WorkRequest.priority)}
                              style={{ margin: 0 }}
                            >
                              {getPriorityLabel(selectedItem.WorkRequest.priority)}
                            </Tag>
                            <Tag
                              color={getWorkRequestStatusColor(selectedItem.WorkRequest.status)}
                              style={{ margin: 0 }}
                            >
                              {getWorkRequestStatusLabel(selectedItem.WorkRequest.status)}
                            </Tag>
                            {selectedItem.WorkRequest.Requester && (
                              <span style={{ fontSize: 13, color: '#595959' }}>
                                요청자: {selectedItem.WorkRequest.Requester.displayName}
                              </span>
                            )}
                            {selectedItem.WorkRequest.Assignee && (
                              <span style={{ fontSize: 13, color: '#595959' }}>
                                담당자: {selectedItem.WorkRequest.Assignee.displayName}
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

                {/* 하위 항목 리스트 - ACTION 타입이 아닐 때만 표시 */}
                {selectedItem.type !== 'ACTION' && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 8 }}>
                      하위 {
                        selectedItem.type === 'PROJECT' ? '서비스' :
                        selectedItem.type === 'SERVICE' ? '팀' :
                        selectedItem.type === 'TEAM' ? '액션' : '항목'
                      } ({selectedItem.children?.length || 0})
                    </div>
                    {selectedItem.children && selectedItem.children.length > 0 ? (
                      <div style={{
                        border: '1px solid #f0f0f0',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        {selectedItem.children.map((child, index) => (
                          <div
                            key={child.id}
                            style={{
                              padding: '10px 12px',
                              borderBottom: index < selectedItem.children!.length - 1 ? '1px solid #f0f0f0' : 'none',
                              cursor: 'pointer',
                              transition: 'background-color 0.2s',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              gap: '16px',
                            }}
                            onClick={() => handleItemClick(child)}
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
                        ))}
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

                          return (
                            <List.Item
                              style={{ padding: '8px 12px' }}
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
                              <List.Item.Meta
                                avatar={
                                  isFile ? (
                                    <FileOutlined style={{ fontSize: 20, color: '#1890ff' }} />
                                  ) : (
                                    <LinkOutlined style={{ fontSize: 20, color: '#52c41a' }} />
                                  )
                                }
                                title={
                                  <Space>
                                    {isFile ? data.originalName : data.displayName}
                                    <span style={{
                                      fontSize: 11,
                                      padding: '2px 6px',
                                      borderRadius: 4,
                                      backgroundColor: isFile ? '#e6f7ff' : '#f6ffed',
                                      color: isFile ? '#1890ff' : '#52c41a',
                                      fontWeight: 600
                                    }}>
                                      {isFile ? '파일' : '링크'}
                                    </span>
                                  </Space>
                                }
                                description={
                                  <Space size="small" style={{ fontSize: 12 }}>
                                    {isFile && (
                                      <>
                                        <span>{formatFileSize(data.filesize)}</span>
                                        <span>•</span>
                                      </>
                                    )}
                                    <span>{isFile ? data.UploadedBy?.displayName : data.CreatedBy?.displayName || '알 수 없음'}</span>
                                    <span>•</span>
                                    <span>{new Date(data.createdAt).toLocaleDateString('ko-KR')}</span>
                                  </Space>
                                }
                              />
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

              {/* 우측 30%: 댓글 */}
              <div style={{ flex: '0 0 30%', display: 'flex', flexDirection: 'column', borderLeft: '1px solid #f0f0f0', paddingLeft: '24px', paddingRight: '24px' }}>
                <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 12, fontWeight: 600 }}>
                  댓글 ({comments.length})
                </div>

                {/* 댓글 목록 */}
                <div style={{ flex: 1, overflowY: 'auto', marginBottom: 16 }}>
                  <List
                    dataSource={comments}
                    locale={{ emptyText: '댓글이 없습니다.' }}
                    renderItem={(comment) => (
                      <List.Item
                        style={{
                          border: 'none',
                          padding: '12px 0',
                          alignItems: 'flex-start',
                        }}
                      >
                        <List.Item.Meta
                          avatar={
                            <Avatar size={32} icon={<UserOutlined />} style={{ backgroundColor: '#1890ff' }} />
                          }
                          title={
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontWeight: 600, fontSize: '13px' }}>
                                {comment.User?.displayName || '알 수 없음'}
                              </span>
                              {(user?.role === 'ADMIN' || comment.userId === user?.id) && (
                                <Popconfirm
                                  title="댓글 삭제"
                                  description="정말 삭제하시겠습니까?"
                                  onConfirm={() => handleDeleteComment(comment.id)}
                                  okText="삭제"
                                  cancelText="취소"
                                >
                                  <Button
                                    type="text"
                                    size="small"
                                    icon={<DeleteOutlined />}
                                    danger
                                  />
                                </Popconfirm>
                              )}
                            </div>
                          }
                          description={
                            <div>
                              <div style={{ fontSize: '13px', color: '#262626', marginBottom: 4, whiteSpace: 'pre-wrap' }}>
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

      {/* Table Section */}
      <div style={{ flex: 1, overflow: 'auto', marginBottom: 16 }}>
        <div style={{ marginBottom: 16 }}>
          {/* 모든 필터를 한 줄에 배치 */}
          <Space wrap style={{ width: '100%' }}>
            <Select
              style={{ width: 180 }}
              placeholder="고객 선택"
              allowClear
              onChange={setSelectedClientId}
              value={selectedClientId}
            >
              {clients.map((client) => (
                <Select.Option key={client.id} value={client.id}>
                  {client.name}
                </Select.Option>
              ))}
            </Select>

            <Select
              mode="multiple"
              style={{ width: 200 }}
              placeholder="프로젝트 필터"
              allowClear
              onChange={setSelectedProjects}
              value={selectedProjects}
              maxTagCount="responsive"
            >
              {uniqueProjects.map((project) => (
                <Select.Option key={project.value} value={project.value}>
                  {project.label}
                </Select.Option>
              ))}
            </Select>

            <Select
              mode="multiple"
              style={{ width: 160 }}
              placeholder="팀 필터"
              allowClear
              onChange={setSelectedTeams}
              value={selectedTeams}
              maxTagCount="responsive"
            >
              {uniqueTeams.map((team) => (
                <Select.Option key={team.value} value={team.value}>
                  {team.label}
                </Select.Option>
              ))}
            </Select>

            <RangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              format="YYYY-MM-DD"
              style={{ width: 260 }}
            />

            <Button size="small" onClick={() => setQuickRange(3)}>3개월</Button>
            <Button size="small" onClick={() => setQuickRange(6)}>6개월</Button>
            <Button size="small" onClick={() => setQuickRange(12)}>1년</Button>
            <Button size="small" onClick={() => setQuickRange(60)}>5년</Button>
            <Button size="small" onClick={() => setQuickRange(120)}>10년</Button>

            <Button onClick={fetchItems}>새로고침</Button>
          </Space>
        </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
        </div>
      ) : (
        <Table
          columns={columns}
          dataSource={flatItems}
          rowKey="id"
          pagination={false}
          scroll={{ x: 'max-content' }}
          size="small"
          bordered
          expandable={{
            showExpandColumn: false,
          }}
          onRow={(record) => ({
            onClick: () => handleItemClick(record),
            style: { cursor: 'pointer' },
          })}
        />
      )}

      {!loading && flatItems.length === 0 && (
        <div style={{ textAlign: 'center', padding: '50px', color: '#999' }}>
          {selectedClientId ? '데이터가 없습니다.' : '고객을 선택해주세요.'}
        </div>
      )}
      </div>
    </div>
  );
};
