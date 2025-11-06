import React, { useState, useEffect, useMemo } from 'react';
import { Typography, message, Modal, Button, Space, Upload, Checkbox, Tag, Progress, List, Avatar, Popover, Mentions, Divider, Popconfirm, Tooltip, Dropdown, Input } from 'antd';
import type { MenuProps } from 'antd';
import { DownloadOutlined, UploadOutlined, SendOutlined, DeleteOutlined, UserOutlined, SmileOutlined, FileOutlined, LinkOutlined, EditOutlined, ArrowRightOutlined, FileTextOutlined, SearchOutlined } from '@ant-design/icons';
import EmojiPicker, { EmojiClickData } from 'emoji-picker-react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { ItemTree } from '../components/ItemTree';
import { ItemFormModal } from '../components/ItemFormModal';
import { PstaFilterDropdown } from '../components/PstaFilterDropdown';
import { HierarchyToggleButtons } from '../components/HierarchyToggleButtons';
import { PstaSettingsDropdown } from '../components/PstaSettingsDropdown';
import { Item, ItemType, ItemStatus, Comment, User, FileAttachment, Link, WorkRequestPriority, WorkRequestStatus } from '../types';
import { itemsApi } from '../api/items';
import { clientsApi } from '../api/clients';
import { commentsApi } from '../api/comments';
import { userApi } from '../api/user';
import { filesApi } from '../api/files';
import { linksApi } from '../api/links';
import { useAuthStore } from '../store/authStore';
import * as XLSX from 'xlsx';
import type { UploadFile } from 'antd';

const { Title } = Typography;

// 미정 프로젝트 및 서비스 UUID
const UNASSIGNED_PROJECT_ID = 'f9c9f2d2-6e0c-4e63-838d-e0a4c5ad4de7';
const UNASSIGNED_SERVICE_ID = 'caeb1542-73bf-4edb-b7c5-073a97771ff1';

export const PstaSchedule: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const [clients, setClients] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [projects, setProjects] = useState<Item[]>([]);
  const [showMyTasksOnly, setShowMyTasksOnly] = useState(false);
  const [hideUnassigned, setHideUnassigned] = useState(true);
  const [selectedClientIds, setSelectedClientIds] = useState<string[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([]);
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [expandedTypes, setExpandedTypes] = useState<Set<ItemType>>(new Set());
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const [parentItem, setParentItem] = useState<Item | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentContent, setCommentContent] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [relatedDocs, setRelatedDocs] = useState<Array<{ type: 'file' | 'link', data: FileAttachment | Link }>>([]);
  const user = useAuthStore((state) => state.user);

  // hideUnassignedIds를 useMemo로 메모이제이션하여 무한 렌더링 방지
  const hideUnassignedIds = useMemo(() => {
    return hideUnassigned ? [UNASSIGNED_PROJECT_ID, UNASSIGNED_SERVICE_ID] : [];
  }, [hideUnassigned]);

  useEffect(() => {
    fetchClients();
    fetchUsers();
    fetchProjects();
  }, []);

  // URL 파라미터에서 itemId를 읽어 해당 항목 자동 선택
  useEffect(() => {
    const itemId = searchParams.get('itemId');
    const shouldEdit = searchParams.get('edit') === 'true';

    if (itemId) {
      loadItemById(itemId, shouldEdit);
      // URL 파라미터 제거 (한 번만 실행)
      setSearchParams({});
    }
  }, [searchParams, setSearchParams]);

  const loadItemById = async (itemId: string, shouldEdit: boolean = false) => {
    try {
      const item = await itemsApi.getItemById(itemId);
      setSelectedItem(item);
      await fetchComments(itemId);

      if (shouldEdit) {
        // 수정 모달 열기
        setEditingItem(item);
        setModalOpen(true);
        message.success('액션 정보를 입력해주세요');
      } else {
        message.success('멘션된 항목으로 이동했습니다');
      }
    } catch (error) {
      console.error('Failed to load item:', error);
      message.error('항목을 불러올 수 없습니다');
    }
  };

  const fetchClients = async () => {
    try {
      const data = await clientsApi.getClients();
      setClients(data);
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

  const fetchProjects = async () => {
    try {
      const projectItems = await itemsApi.getItems({ type: ItemType.PROJECT });
      setProjects(projectItems);
    } catch (error) {
      console.error('Failed to fetch projects:', error);
    }
  };


  const handleHierarchyToggle = (type: ItemType) => {
    const newExpandedTypes = new Set(expandedTypes);

    // 계층 순서: PROJECT -> SERVICE -> TEAM -> ACTION
    const hierarchy = [ItemType.PROJECT, ItemType.SERVICE, ItemType.TEAM, ItemType.ACTION];
    const clickedIndex = hierarchy.indexOf(type);

    if (newExpandedTypes.has(type)) {
      // 이미 펼쳐져 있으면 해당 계층과 하위 계층 모두 제거
      for (let i = clickedIndex; i < hierarchy.length; i++) {
        newExpandedTypes.delete(hierarchy[i]);
      }
    } else {
      // 접혀 있으면 해당 계층까지 모두 추가
      for (let i = 0; i <= clickedIndex; i++) {
        newExpandedTypes.add(hierarchy[i]);
      }
    }

    setExpandedTypes(newExpandedTypes);
  };

  const handleAdd = (parentId?: string, type?: ItemType) => {
    setEditingItem(null);
    setParentItem(parentId ? { id: parentId } as Item : null);
    setModalOpen(true);
  };

  const handleEdit = (item: Item) => {
    setEditingItem(item);
    setParentItem(null);
    setSelectedItem(null); // 상세 모달 닫기
    setModalOpen(true);
  };

  const handleDelete = (id: string) => {
    Modal.confirm({
      title: '항목을 삭제하시겠습니까?',
      content: '하위 항목도 함께 삭제됩니다.',
      okText: '삭제',
      okType: 'danger',
      cancelText: '취소',
      onOk: async () => {
        try {
          await itemsApi.deleteItem(id);
          message.success('삭제되었습니다');
          setRefreshKey((prev) => prev + 1);
        } catch (error: any) {
          if (error.response?.status === 403) {
            message.error('권한이 없습니다. 생성자 또는 최고관리자만 삭제할 수 있습니다.');
          } else {
            message.error('삭제 실패: ' + (error.response?.data?.error || error.message));
          }
        }
      },
    });
  };

  const handleSubmit = async (values: any) => {
    try {
      if (editingItem) {
        await itemsApi.updateItem(editingItem.id, values);
        message.success('수정되었습니다');
      } else {
        await itemsApi.createItem(values);
        message.success('생성되었습니다');
      }
      setModalOpen(false);
      setEditingItem(null);
      setParentItem(null);
      setRefreshKey((prev) => prev + 1);
    } catch (error: any) {
      if (error.response?.status === 403) {
        message.error('권한이 없습니다. 생성자 또는 최고관리자만 수정할 수 있습니다.');
      } else {
        message.error(error.response?.data?.error || '작업 실패');
      }
    }
  };

  const handleExport = async () => {
    try {
      const allData: any[] = [];

      for (const client of clients) {
        const data = await itemsApi.getItemTree(client.id);
        const flatData = flattenItemsForExport(data, 0, '', client.name);
        allData.push(...flatData);
      }

      const worksheet = XLSX.utils.json_to_sheet(allData);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'PSTA');

      XLSX.writeFile(workbook, `PSTA_전체_${new Date().toISOString().split('T')[0]}.xlsx`);
      message.success('Excel 파일이 다운로드되었습니다');
    } catch (error: any) {
      message.error('Export 실패: ' + error.message);
    }
  };

  const flattenItemsForExport = (items: Item[], level = 0, parentPath = '', clientName = ''): any[] => {
    const result: any[] = [];

    items.forEach((item) => {
      const path = parentPath ? `${parentPath} > ${item.name}` : item.name;
      const client = clientName || item.Client?.name || '';

      result.push({
        'Client': client,
        'Level': level,
        'Type': item.type,
        'Name': item.name,
        'Path': path,
        'Status': item.status,
        'Progress': item.progress,
        'Start Date': item.startDate ? new Date(item.startDate).toISOString().split('T')[0] : '',
        'End Date': item.endDate ? new Date(item.endDate).toISOString().split('T')[0] : '',
        'Assignee': item.User_Item_assigneeIdToUser?.displayName || '',
        'Description': item.description || '',
      });

      if (item.children && item.children.length > 0) {
        result.push(...flattenItemsForExport(item.children, level + 1, path, client));
      }
    });

    return result;
  };

  const handleImport = async (file: File) => {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);

          await importItems(jsonData);
          message.success('Import 완료');
          setRefreshKey((prev) => prev + 1);
        } catch (error: any) {
          message.error('Import 실패: ' + error.message);
        }
      };
      reader.readAsBinaryString(file);
      return false;
    } catch (error: any) {
      message.error('파일 읽기 실패: ' + error.message);
      return false;
    }
  };

  const importItems = async (jsonData: any[]) => {
    const itemMap = new Map<string, string>(); // client:path -> id mapping
    const existingItems = new Map<string, string>(); // client:path -> id for existing items

    // Check for existing items to prevent duplicates
    for (const client of clients) {
      const existingData = await itemsApi.getItemTree(client.id);
      const flatExisting = flattenItemsForExport(existingData, 0, '', client.name);

      flatExisting.forEach((item: any) => {
        const key = `${item.Client}:${item.Path}`;
        existingItems.set(key, item.id);
      });
    }

    let skipCount = 0;
    let createCount = 0;

    for (const row of jsonData) {
      const clientName = row['Client'] || '';
      const level = row['Level'];
      const type = row['Type'] as ItemType;
      const name = row['Name'];
      const path = row['Path'];
      const status = row['Status'] as ItemStatus || ItemStatus.NOT_STARTED;
      const progress = row['Progress'] || 0;
      const startDate = row['Start Date'] ? new Date(row['Start Date']).toISOString() : undefined;
      const endDate = row['End Date'] ? new Date(row['End Date']).toISOString() : undefined;
      const description = row['Description'] || '';

      // Find client by name
      const client = clients.find(c => c.name === clientName);
      if (!client) {
        console.warn(`Client not found: ${clientName}, skipping item: ${name}`);
        continue;
      }

      const itemKey = `${clientName}:${path}`;

      // Check if item already exists
      if (existingItems.has(itemKey)) {
        skipCount++;
        // Use existing item id for children mapping
        itemMap.set(itemKey, existingItems.get(itemKey)!);
        continue;
      }

      let parentId: string | undefined = undefined;

      if (level > 0) {
        const pathParts = path.split(' > ');
        const parentPath = pathParts.slice(0, -1).join(' > ');
        const parentKey = `${clientName}:${parentPath}`;
        parentId = itemMap.get(parentKey);
      }

      const itemData = {
        type,
        name,
        status,
        progress,
        startDate,
        endDate,
        description,
        clientId: client.id,
        parentId,
      };

      const createdItem = await itemsApi.createItem(itemData);
      itemMap.set(itemKey, createdItem.id);
      createCount++;
    }

    console.log(`Import 완료: ${createCount}개 생성, ${skipCount}개 중복 스킵`);
    if (skipCount > 0) {
      message.info(`${createCount}개 항목이 생성되었고, ${skipCount}개 중복 항목은 건너뛰었습니다.`);
    }
  };


  const handleItemClick = async (item: Item) => {
    try {
      // getItemById를 호출하여 WorkRequest 등 모든 관계 데이터 포함
      const fullItem = await itemsApi.getItemById(item.id);
      setSelectedItem(fullItem);
      setCommentContent('');
      await fetchComments(item.id);
      await loadRelatedDocuments(item.id);
    } catch (error) {
      console.error('Failed to load item:', error);
      // 실패 시 기존 item으로라도 표시
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

  const loadRelatedDocuments = async (itemId: string) => {
    try {
      const { files: hierarchicalFiles, links: hierarchicalLinks } = await filesApi.getHierarchicalDocuments(itemId);

      // Combine files and links into a single array with type indicator
      const combined: Array<{ type: 'file' | 'link', data: FileAttachment | Link }> = [
        ...hierarchicalFiles.map(f => ({ type: 'file' as const, data: f })),
        ...hierarchicalLinks.map(l => ({ type: 'link' as const, data: l })),
      ];

      // Sort by createdAt descending (most recent first)
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

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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

  const handleReactionToggle = async (commentId: string, emoji: string) => {
    if (!selectedItem) return;

    try {
      await commentsApi.toggleReaction(commentId, emoji);
      await fetchComments(selectedItem.id);
    } catch (error: any) {
      message.error('반응 추가/제거에 실패했습니다.');
    }
  };

  const renderCommentContent = (content: string) => {
    // Replace @mentions with highlighted spans (format: @[displayName](userId))
    const mentionRegex = /@\[([^\]]+)\]\(([^)]+)\)/g;
    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = mentionRegex.exec(content)) !== null) {
      // Add text before mention
      if (match.index > lastIndex) {
        parts.push(content.substring(lastIndex, match.index));
      }
      // Add highlighted mention
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

    // Add remaining text
    if (lastIndex < content.length) {
      parts.push(content.substring(lastIndex));
    }

    return parts.length > 0 ? parts : content;
  };

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

  return (
    <div style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* 상세 정보 패널 */}
      <div
        style={{
          flex: selectedItem ? '0 0 60%' : '0 0 0%',
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

              {/* 우측: 기간 + 진행률 + 수정/삭제 버튼 */}
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

                {/* 수정 버튼 - 팀은 수정 불가, 생성자 또는 ADMIN만 가능 */}
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
                        onClick={() => handleEdit(selectedItem)}
                        type="default"
                        disabled={isDisabled}
                      >
                        수정
                      </Button>
                    </Tooltip>
                  );
                })()}

                {/* 삭제 버튼 - 하위 항목이 있으면 비활성화, 생성자 또는 ADMIN만 가능 */}
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
                      description={
                        hasChildren
                          ? "하위 항목이 있어 삭제할 수 없습니다."
                          : "이 항목을 삭제하시겠습니까?"
                      }
                      onConfirm={() => {
                        if (!hasChildren) {
                          handleDelete(selectedItem.id);
                          handleCloseDetail();
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
              <Button onClick={handleCloseDetail} type="text">
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
                      <div style={{ fontWeight: 500 }}>{selectedItem.Client?.name || '-'}</div>
                    </div>
                  </div>
                  <div>
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 4 }}>담당자</div>
                      <div style={{ fontWeight: 500 }}>{selectedItem.User_Item_assigneeIdToUser?.displayName || '-'}</div>
                    </div>
                  </div>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <div style={{ color: '#8c8c8c', fontSize: '12px', marginBottom: 4 }}>설명</div>
                  <div style={{
                    padding: '12px',
                    backgroundColor: '#fafafa',
                    borderRadius: '4px',
                    whiteSpace: 'pre-wrap',
                    color: selectedItem.description ? '#000' : '#bfbfbf',
                    fontStyle: selectedItem.description ? 'normal' : 'italic'
                  }}>
                    {selectedItem.description || '등록된 설명이 없습니다.'}
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
                        {/* 아이콘 */}
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

                        {/* 내용 */}
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

                        {/* 화살표 */}
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
                            {/* 좌측 그룹: 업무계층, 상태, PSTA 명 */}
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

                            {/* 우측 그룹: 담당자, 진행일정, 진행률 */}
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

              {/* 오른쪽 영역 (30%) - 댓글 */}
              <div style={{
                flex: '0 0 30%',
                borderLeft: '1px solid #f0f0f0',
                paddingLeft: '20px',
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
                                  {/* 이모티콘 반응 - 이름 옆 */}
                                  <div style={{ display: 'flex', gap: 2, alignItems: 'center' }}>
                                    {(() => {
                                      // 이모티콘 순서와 이름 정의
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
                                            {/* 기존 반응들 - 설정된 순서대로 표시 */}
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

                                            {/* 새 반응 추가 버튼 - 순서대로 표시 */}
                                            {emojiConfig.map(({ emoji, name }) => {
                                              const userIds = reactions[emoji];
                                              // 이미 사용된 이모티콘은 표시하지 않음
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

      {/* 테이블 영역 */}
      <div style={{
        flex: selectedItem ? '0 0 40%' : '1',
        overflow: 'hidden',
        transition: 'flex 0.3s ease-in-out',
        display: 'flex',
        flexDirection: 'column'
      }}>
        <div style={{ marginBottom: 12, flexShrink: 0, paddingRight: 8, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <Space size={12}>
            <PstaSettingsDropdown
              onExport={handleExport}
              onImport={handleImport}
            />
            <PstaFilterDropdown
              showMyTasksOnly={showMyTasksOnly}
              hideUnassigned={hideUnassigned}
              onShowMyTasksOnlyChange={(checked) => {
                setShowMyTasksOnly(checked);
                setRefreshKey((prev) => prev + 1);
              }}
              onHideUnassignedChange={(checked) => {
                setHideUnassigned(checked);
                setRefreshKey((prev) => prev + 1);
              }}
            />
            <Dropdown
              menu={{
                items: clients.map(client => ({
                  key: client.id,
                  label: (
                    <Checkbox
                      checked={selectedClientIds.includes(client.id)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setSelectedClientIds(prev =>
                          checked ? [...prev, client.id] : prev.filter(id => id !== client.id)
                        );
                        setRefreshKey((prev) => prev + 1);
                      }}
                    >
                      {client.name}
                    </Checkbox>
                  ),
                })),
              }}
              trigger={['click']}
            >
              <Button>
                고객 선택 {selectedClientIds.length > 0 && `(${selectedClientIds.length})`}
              </Button>
            </Dropdown>
            <Dropdown
              menu={{
                items: projects
                  .filter(p => selectedClientIds.length === 0 || selectedClientIds.includes(p.clientId || ''))
                  .map(project => ({
                    key: project.id,
                    label: (
                      <Checkbox
                        checked={selectedProjectIds.includes(project.id)}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setSelectedProjectIds(prev =>
                            checked ? [...prev, project.id] : prev.filter(id => id !== project.id)
                          );
                          setRefreshKey((prev) => prev + 1);
                        }}
                      >
                        {project.name}
                      </Checkbox>
                    ),
                  })),
              }}
              trigger={['click']}
            >
              <Button>
                프로젝트 선택 {selectedProjectIds.length > 0 && `(${selectedProjectIds.length})`}
              </Button>
            </Dropdown>
            <HierarchyToggleButtons
              expandedTypes={expandedTypes}
              onToggle={handleHierarchyToggle}
            />
          </Space>
          <Input
            placeholder="PSTA 명 검색"
            prefix={<SearchOutlined />}
            allowClear
            style={{ width: 250 }}
            value={searchKeyword}
            onChange={(e) => setSearchKeyword(e.target.value)}
          />
        </div>
        <div style={{ flex: 1, overflow: 'hidden', height: 0 }}>
          <ItemTree
            key={refreshKey}
            userTeamId={showMyTasksOnly ? user?.teamId : undefined}
            expandedTypes={expandedTypes}
            onAdd={handleAdd}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onItemClick={handleItemClick}
            hasDetailPanel={!!selectedItem}
            hideUnassignedIds={hideUnassignedIds}
            selectedClientIds={selectedClientIds}
            selectedProjectIds={selectedProjectIds}
            searchKeyword={searchKeyword}
          />
        </div>
      </div>
      <ItemFormModal
        open={modalOpen}
        item={editingItem}
        parentItem={parentItem}
        onCancel={() => {
          setModalOpen(false);
          setEditingItem(null);
          setParentItem(null);
        }}
        onSubmit={handleSubmit}
        onRefresh={() => setRefreshKey((prev) => prev + 1)}
        clients={clients}
        users={users}
      />
    </div>
  );
};
