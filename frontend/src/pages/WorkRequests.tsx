import React, { useState, useEffect } from 'react';
import { Typography, Table, Button, Space, Tag, Popconfirm, message, Tabs, Modal, Descriptions, Divider, Select, Input, Segmented } from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
  EyeOutlined,
  RollbackOutlined,
  FolderOutlined,
  AppstoreOutlined,
  TeamOutlined,
  CheckCircleOutlined,
  ArrowRightOutlined,
  UserAddOutlined,
  CloseCircleOutlined,
  MessageOutlined,
  SearchOutlined,
} from '@ant-design/icons';

const { TextArea } = Input;
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import { WorkRequest, WorkRequestPriority, WorkRequestStatus, ItemStatus, ItemType } from '../types';
import { workRequestsApi } from '../api/work-requests';
import { teamApi } from '../api/team';
import { itemsApi } from '../api/items';
import { WorkRequestDrawer } from '../components/WorkRequestDrawer';
import { HierarchyRequestModal } from '../components/HierarchyRequestModal';
import dayjs from 'dayjs';
import '../components/TiptapEditor.css';

const { Title } = Typography;

export const WorkRequests: React.FC = () => {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [myWorkRequests, setMyWorkRequests] = useState<WorkRequest[]>([]);
  const [assignedWorkRequests, setAssignedWorkRequests] = useState<WorkRequest[]>([]);
  const [teamWorkRequests, setTeamWorkRequests] = useState<WorkRequest[]>([]);
  const [allWorkRequests, setAllWorkRequests] = useState<WorkRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedWorkRequest, setSelectedWorkRequest] = useState<WorkRequest | null>(null);
  const [activeTab, setActiveTab] = useState(user?.role === 'ADMIN' ? 'all' : 'received');
  const [receivedFilter, setReceivedFilter] = useState<'all' | 'assigned' | 'team'>('all');
  const [sentSearchText, setSentSearchText] = useState('');
  const [receivedSearchText, setReceivedSearchText] = useState('');
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [selectedAssignee, setSelectedAssignee] = useState<string | undefined>();
  const [assigning, setAssigning] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectionMessage, setRejectionMessage] = useState('');
  const [rejecting, setRejecting] = useState(false);
  const [negotiationModalOpen, setNegotiationModalOpen] = useState(false);
  const [negotiationMessage, setNegotiationMessage] = useState('');
  const [negotiating, setNegotiating] = useState(false);
  const [hierarchyModalOpen, setHierarchyModalOpen] = useState(false);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [serviceCreateModalOpen, setServiceCreateModalOpen] = useState(false);
  const [serviceName, setServiceName] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [creatingService, setCreatingService] = useState(false);
  const [teamAssignModalOpen, setTeamAssignModalOpen] = useState(false);
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | undefined>();
  const [forwardModalOpen, setForwardModalOpen] = useState(false);
  const [forwardUsers, setForwardUsers] = useState<any[]>([]);
  const [selectedForwardUser, setSelectedForwardUser] = useState<string | undefined>();
  const [forwarding, setForwarding] = useState(false);
  const [allSearchText, setAllSearchText] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    loadWorkRequests();
  }, []);

  // URL 파라미터에서 workRequestId를 읽어 해당 작업 요청 자동 선택
  useEffect(() => {
    const workRequestId = searchParams.get('workRequestId');
    if (workRequestId && (myWorkRequests.length > 0 || assignedWorkRequests.length > 0 || teamWorkRequests.length > 0)) {
      loadWorkRequestById(workRequestId);
      // URL 파라미터 제거 (한 번만 실행)
      setSearchParams({});
    }
  }, [searchParams, myWorkRequests, assignedWorkRequests, teamWorkRequests, setSearchParams]);

  const loadWorkRequestById = async (workRequestId: string) => {
    try {
      const workRequest = await workRequestsApi.getWorkRequestById(workRequestId);
      setSelectedWorkRequest(workRequest);
      setDetailModalOpen(true);
      message.success('연결된 작업 요청으로 이동했습니다');
    } catch (error) {
      console.error('Failed to load work request:', error);
      message.error('작업 요청을 불러올 수 없습니다');
    }
  };

  const loadWorkRequests = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const promises: Promise<WorkRequest[]>[] = [
        workRequestsApi.getWorkRequests({ requesterId: user.id }),
        workRequestsApi.getWorkRequests({ assigneeId: user.id }),
        workRequestsApi.getTeamWorkRequests(),
      ];

      // Load all work requests for admin
      if (user?.role === 'ADMIN') {
        promises.push(workRequestsApi.getAllWorkRequests());
      }

      const results = await Promise.all(promises);
      setMyWorkRequests(results[0]);
      setAssignedWorkRequests(results[1]);
      setTeamWorkRequests(results[2]);
      if (user?.role === 'ADMIN' && results[3]) {
        setAllWorkRequests(results[3]);
      }
    } catch (error) {
      console.error('Failed to load work requests:', error);
      message.error('작업 요청 목록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = () => {
    setSelectedWorkRequest(null);
    setDrawerOpen(true);
  };

  const handleEdit = (record: WorkRequest) => {
    setSelectedWorkRequest(record);
    setDrawerOpen(true);
  };

  const handleOpenAssignModal = async (record: WorkRequest) => {
    if (!record.assigneeTeamId) {
      message.error('팀 할당 작업 요청만 개인 담당자를 지정할 수 있습니다');
      return;
    }

    try {
      setSelectedWorkRequest(record);
      const members = await teamApi.getTeamMembers(record.assigneeTeamId);
      setTeamMembers(members);
      setSelectedAssignee(undefined);
      setAssignModalOpen(true);
    } catch (error: any) {
      message.error('팀 멤버 조회 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleAssign = async () => {
    if (!selectedWorkRequest || !selectedAssignee) {
      message.error('담당자를 선택해주세요');
      return;
    }

    try {
      setAssigning(true);
      await workRequestsApi.assignToIndividual(selectedWorkRequest.id, selectedAssignee);
      message.success('담당자가 지정되었습니다');
      setAssignModalOpen(false);
      setSelectedAssignee(undefined);
      await loadWorkRequests();
    } catch (error: any) {
      message.error('할당 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setAssigning(false);
    }
  };

  const canAssign = (record: WorkRequest): boolean => {
    if (!user) return false;
    if (user.role === 'ADMIN') return true;
    if (!record.assigneeTeamId || record.assigneeId) return false;
    // Check if user is in the team and is PM/PO
    if (user.Team?.id === record.assigneeTeamId) {
      return user.role === 'PM' || user.role === 'PO';
    }
    return false;
  };

  const handleViewDetail = (record: WorkRequest) => {
    setSelectedWorkRequest(record);
    setDetailModalOpen(true);
  };

  const handleRecall = async (id: string) => {
    try {
      await workRequestsApi.recallWorkRequest(id);
      message.success('작업 요청이 회수되었습니다.');
      loadWorkRequests();
    } catch (error: any) {
      console.error('Recall error:', error);
      message.error(error.response?.data?.error || '회수에 실패했습니다.');
    }
  };

  const handleResubmit = async (id: string) => {
    try {
      await workRequestsApi.resubmitWorkRequest(id);
      message.success('작업 요청이 재요청되었습니다.');
      setDetailModalOpen(false);
      loadWorkRequests();
    } catch (error: any) {
      console.error('Resubmit error:', error);
      message.error(error.response?.data?.error || '재요청에 실패했습니다.');
    }
  };

  const handleApprove = async (id: string) => {
    try {
      await workRequestsApi.approveWorkRequest(id);
      message.success('작업 요청이 승인되었습니다.');
      loadWorkRequests();
    } catch (error: any) {
      console.error('Approve error:', error);
      message.error(error.response?.data?.error || '승인에 실패했습니다.');
    }
  };

  const handleUnapprove = async (id: string) => {
    try {
      await workRequestsApi.unapproveWorkRequest(id);
      message.success('승인이 취소되었습니다.');
      setDetailModalOpen(false);
      loadWorkRequests();
    } catch (error: any) {
      console.error('Unapprove error:', error);
      message.error(error.response?.data?.error || '승인 취소에 실패했습니다.');
    }
  };

  const handleCreateAction = async () => {
    if (!selectedWorkRequest) return;

    try {
      // Step 1: Validate hierarchy before creating action
      const validation = await workRequestsApi.validateActionCreation(selectedWorkRequest.id);

      if (!validation.canCreateAction) {
        // 계층 구조가 불완전함 - HierarchyRequestModal 표시
        setValidationResult(validation);
        setHierarchyModalOpen(true);
        return;
      }

      // Step 2: Hierarchy is complete, proceed with action creation
      const updatedWorkRequest = await workRequestsApi.createActionFromWorkRequest(selectedWorkRequest.id);
      message.success('액션이 생성되었습니다. 상세 정보를 입력해주세요.');
      setDetailModalOpen(false);

      // 생성된 액션의 수정 폼을 열기 위해 PSTA 페이지로 이동
      if (updatedWorkRequest.Action) {
        navigate(`/psta?itemId=${updatedWorkRequest.Action.id}&edit=true`);
      }
    } catch (error: any) {
      console.error('Create action error:', error);

      // Check if error is due to missing hierarchy
      if (error.response?.data?.needsHierarchy) {
        message.warning(error.response.data.error);
        // Re-validate to get proper suggestions
        try {
          const validation = await workRequestsApi.validateActionCreation(selectedWorkRequest.id);
          setValidationResult(validation);
          setHierarchyModalOpen(true);
        } catch (validationError) {
          message.error('계층 검증에 실패했습니다.');
        }
      } else {
        message.error(error.response?.data?.error || '액션 생성에 실패했습니다.');
      }
    }
  };

  const handleGoToAction = (actionId: string) => {
    setDetailModalOpen(false);
    navigate(`/psta?itemId=${actionId}`);
  };

  const handleReject = async () => {
    if (!selectedWorkRequest) return;

    try {
      setRejecting(true);
      await workRequestsApi.rejectWorkRequest(selectedWorkRequest.id, rejectionMessage);
      message.success('작업 요청이 반려되었습니다.');
      setRejectModalOpen(false);
      setRejectionMessage('');
      setDetailModalOpen(false);
      await loadWorkRequests();
    } catch (error: any) {
      console.error('Reject error:', error);
      message.error(error.response?.data?.error || '반려에 실패했습니다.');
    } finally {
      setRejecting(false);
    }
  };

  const handleNegotiate = async () => {
    if (!selectedWorkRequest) return;

    if (!negotiationMessage.trim()) {
      message.error('협의 메시지를 입력해주세요.');
      return;
    }

    try {
      setNegotiating(true);
      await workRequestsApi.requestNegotiation(selectedWorkRequest.id, negotiationMessage);
      message.success('협의 요청이 전송되었습니다.');
      setNegotiationModalOpen(false);
      setNegotiationMessage('');
      setDetailModalOpen(false);
      await loadWorkRequests();
    } catch (error: any) {
      console.error('Negotiation error:', error);
      message.error(error.response?.data?.error || '협의 요청에 실패했습니다.');
    } finally {
      setNegotiating(false);
    }
  };

  const handleOpenServiceCreate = () => {
    setServiceName('');
    setServiceDescription('');
    setServiceCreateModalOpen(true);
  };

  const handleServiceCreate = async () => {
    if (!selectedWorkRequest || !serviceName.trim()) {
      message.error('서비스 이름을 입력해주세요');
      return;
    }

    if (!selectedWorkRequest.projectId) {
      message.error('프로젝트 정보가 없습니다');
      return;
    }

    try {
      setCreatingService(true);
      // Create new service under the project
      const newService = await itemsApi.createItem({
        name: serviceName,
        description: serviceDescription,
        type: ItemType.SERVICE,
        parentId: selectedWorkRequest.projectId,
        status: ItemStatus.NOT_STARTED,
      });

      // Update work request with the new serviceId
      await workRequestsApi.updateWorkRequest(selectedWorkRequest.id, {
        serviceId: newService.id,
      });

      message.success('서비스가 생성되고 할당되었습니다');
      setServiceCreateModalOpen(false);
      setServiceName('');
      setServiceDescription('');
      await loadWorkRequests();
      // 상세 모달의 작업 요청 정보도 업데이트
      const updated = await workRequestsApi.getWorkRequestById(selectedWorkRequest.id);
      setSelectedWorkRequest(updated);
    } catch (error: any) {
      message.error('서비스 생성 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setCreatingService(false);
    }
  };

  const handleOpenTeamAssign = async () => {
    if (!selectedWorkRequest?.serviceId) return;

    try {
      // Team 테이블에서 모든 팀 목록 조회 (활성화된 팀만)
      const allTeams = await teamApi.getAll();
      const activeTeams = allTeams.filter(team => team.isActive);
      setAvailableTeams(activeTeams);
      setSelectedTeamId(undefined);
      setTeamAssignModalOpen(true);
    } catch (error: any) {
      message.error('팀 목록 조회 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleTeamAssign = async () => {
    if (!selectedWorkRequest || !selectedTeamId) {
      message.error('팀을 선택해주세요');
      return;
    }

    if (!selectedWorkRequest.serviceId) {
      message.error('서비스 정보가 없습니다');
      return;
    }

    try {
      // 1. 선택한 팀의 정보 가져오기
      const selectedTeam = availableTeams.find(t => t.id === selectedTeamId);
      if (!selectedTeam) {
        message.error('선택한 팀 정보를 찾을 수 없습니다');
        return;
      }

      // 2. 서비스 하위에 해당 팀 이름의 TEAM 아이템이 있는지 확인
      const existingTeamItems = await itemsApi.getItems({
        parentId: selectedWorkRequest.serviceId,
        type: 'TEAM',
      });

      let teamItemId: string;
      const existingTeamItem = existingTeamItems.find(
        item => item.name === selectedTeam.name
      );

      if (existingTeamItem) {
        // 이미 존재하는 TEAM 아이템 사용
        teamItemId = existingTeamItem.id;
      } else {
        // 새로운 TEAM 아이템 생성
        const newTeamItem = await itemsApi.createItem({
          name: selectedTeam.name,
          description: selectedTeam.description,
          type: ItemType.TEAM,
          parentId: selectedWorkRequest.serviceId,
          status: ItemStatus.NOT_STARTED,
        });
        teamItemId = newTeamItem.id;
      }

      // 3. WorkRequest의 teamId 업데이트
      await workRequestsApi.updateWorkRequest(selectedWorkRequest.id, {
        teamId: teamItemId,
      });

      message.success('팀이 할당되었습니다');
      setTeamAssignModalOpen(false);
      setSelectedTeamId(undefined);
      await loadWorkRequests();
      // 상세 모달의 작업 요청 정보도 업데이트
      const updated = await workRequestsApi.getWorkRequestById(selectedWorkRequest.id);
      setSelectedWorkRequest(updated);
    } catch (error: any) {
      message.error('팀 할당 실패: ' + (error.response?.data?.error || error.message));
    }
  };

  const handleOpenForwardModal = async () => {
    try {
      // 모든 사용자 조회 (본인 제외)
      const response = await fetch('/api/users', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });

      if (!response.ok) throw new Error('사용자 목록 조회 실패');

      const allUsers = await response.json();
      const filteredUsers = allUsers.filter((u: any) => u.id !== user?.id);

      setForwardUsers(filteredUsers);
      setSelectedForwardUser(undefined);
      setForwardModalOpen(true);
    } catch (error: any) {
      message.error('사용자 목록 조회 실패: ' + error.message);
    }
  };

  const handleForward = async () => {
    if (!selectedWorkRequest || !selectedForwardUser) {
      message.error('전달받을 사용자를 선택해주세요');
      return;
    }

    setForwarding(true);
    try {
      await workRequestsApi.forwardWorkRequest(selectedWorkRequest.id, selectedForwardUser);
      message.success('작업 요청이 전달되었습니다');
      setForwardModalOpen(false);
      setDetailModalOpen(false);
      setSelectedForwardUser(undefined);
      await loadWorkRequests();
    } catch (error: any) {
      message.error('전달 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setForwarding(false);
    }
  };

  const handleCancel = async () => {
    if (!selectedWorkRequest) return;

    setCancelling(true);
    try {
      await workRequestsApi.cancelWorkRequest(selectedWorkRequest.id);
      message.success('작업 요청이 취소되었습니다.');
      setDetailModalOpen(false);
      await loadWorkRequests();
    } catch (error: any) {
      message.error(error.response?.data?.error || '취소에 실패했습니다.');
    } finally {
      setCancelling(false);
    }
  };

  const handleAdminDelete = async (id: string) => {
    try {
      await workRequestsApi.adminDeleteWorkRequest(id);
      message.success('작업 요청이 관리자에 의해 삭제되었습니다.');
      setDetailModalOpen(false);
      loadWorkRequests();
    } catch (error: any) {
      console.error('Admin delete error:', error);
      message.error(error.response?.data?.error || '삭제에 실패했습니다.');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await workRequestsApi.deleteWorkRequest(id);
      message.success('작업 요청이 삭제되었습니다.');
      loadWorkRequests();
    } catch (error: any) {
      console.error('Delete error:', error);
      message.error(error.response?.data?.error || '삭제에 실패했습니다.');
    }
  };

  const getPriorityColor = (priority: WorkRequestPriority) => {
    switch (priority) {
      case WorkRequestPriority.LOW:
        return 'green';
      case WorkRequestPriority.MEDIUM:
        return 'blue';
      case WorkRequestPriority.HIGH:
        return 'orange';
      case WorkRequestPriority.URGENT:
        return 'red';
      default:
        return 'default';
    }
  };

  const getPriorityLabel = (priority: WorkRequestPriority) => {
    switch (priority) {
      case WorkRequestPriority.LOW:
        return '낮음';
      case WorkRequestPriority.MEDIUM:
        return '보통';
      case WorkRequestPriority.HIGH:
        return '높음';
      case WorkRequestPriority.URGENT:
        return '긴급';
      default:
        return priority;
    }
  };

  const getStatusColor = (status: WorkRequestStatus | ItemStatus) => {
    switch (status) {
      case WorkRequestStatus.PENDING:
      case ItemStatus.NOT_STARTED:
        return 'default';
      case WorkRequestStatus.IN_PROGRESS:
      case ItemStatus.IN_PROGRESS:
        return 'blue';
      case WorkRequestStatus.COMPLETED:
      case ItemStatus.COMPLETED:
        return 'green';
      case WorkRequestStatus.CANCELLED:
        return 'red';
      case WorkRequestStatus.REJECTED:
        return 'volcano';
      case WorkRequestStatus.IN_NEGOTIATION:
        return 'gold';
      case ItemStatus.ON_HOLD:
        return 'orange';
      default:
        return 'default';
    }
  };

  const getStatusLabel = (status: WorkRequestStatus | ItemStatus) => {
    switch (status) {
      case WorkRequestStatus.PENDING:
        return '대기';
      case ItemStatus.NOT_STARTED:
        return '시작 전';
      case WorkRequestStatus.IN_PROGRESS:
      case ItemStatus.IN_PROGRESS:
        return '진행중';
      case WorkRequestStatus.COMPLETED:
      case ItemStatus.COMPLETED:
        return '완료';
      case WorkRequestStatus.CANCELLED:
        return '취소됨';
      case WorkRequestStatus.REJECTED:
        return '반려';
      case WorkRequestStatus.IN_NEGOTIATION:
        return '협의중';
      case ItemStatus.ON_HOLD:
        return '보류';
      default:
        return status;
    }
  };

  const columns = [
    {
      title: '제목',
      dataIndex: 'title',
      key: 'title',
      width: '30%',
      render: (title: string, record: WorkRequest) => (
        <Button
          type="link"
          onClick={() => handleViewDetail(record)}
          style={{ padding: 0, height: 'auto', textAlign: 'left' }}
        >
          {title}
        </Button>
      ),
    },
    {
      title: '우선순위',
      dataIndex: 'priority',
      key: 'priority',
      width: '10%',
      filters: [
        { text: '긴급', value: WorkRequestPriority.URGENT },
        { text: '높음', value: WorkRequestPriority.HIGH },
        { text: '보통', value: WorkRequestPriority.MEDIUM },
        { text: '낮음', value: WorkRequestPriority.LOW },
      ],
      onFilter: (value: any, record: WorkRequest) => record.priority === value,
      render: (priority: WorkRequestPriority) => (
        <Tag color={getPriorityColor(priority)}>{getPriorityLabel(priority)}</Tag>
      ),
    },
    {
      title: '상태',
      dataIndex: 'status',
      key: 'status',
      width: '10%',
      filters: [
        { text: '대기', value: 'PENDING' },
        { text: '회수됨', value: 'RECALLED' },
        { text: '승인됨', value: 'APPROVED' },
        { text: '반려', value: 'REJECTED' },
        { text: '협의중', value: 'IN_NEGOTIATION' },
        { text: '취소됨', value: 'CANCELLED' },
        { text: '시작 전', value: 'ACTION_NOT_STARTED' },
        { text: '진행중', value: 'ACTION_IN_PROGRESS' },
        { text: '완료', value: 'ACTION_COMPLETED' },
        { text: '보류', value: 'ACTION_ON_HOLD' },
      ],
      onFilter: (value: any, record: WorkRequest) => {
        // 액션이 생성된 경우 - 액션의 상태로 필터링
        if (record.Action) {
          if (value === 'ACTION_NOT_STARTED' && record.Action.status === ItemStatus.NOT_STARTED) return true;
          if (value === 'ACTION_IN_PROGRESS' && record.Action.status === ItemStatus.IN_PROGRESS) return true;
          if (value === 'ACTION_COMPLETED' && record.Action.status === ItemStatus.COMPLETED) return true;
          if (value === 'ACTION_ON_HOLD' && record.Action.status === ItemStatus.ON_HOLD) return true;
          return false;
        }

        // 액션 생성 전 워크플로우 상태로 필터링
        if (value === 'RECALLED' && record.isRecalled) return true;
        if (value === 'APPROVED' && record.isApproved && !record.isRecalled) return true;
        if (value === 'REJECTED' && record.status === WorkRequestStatus.REJECTED) return true;
        if (value === 'IN_NEGOTIATION' && record.status === WorkRequestStatus.IN_NEGOTIATION) return true;
        if (value === 'CANCELLED' && record.status === WorkRequestStatus.CANCELLED) return true;
        if (value === 'PENDING' && !record.isRecalled && !record.isApproved && record.status === WorkRequestStatus.PENDING) return true;

        return false;
      },
      render: (status: WorkRequestStatus, record: WorkRequest) => {
        // 액션이 생성된 경우 액션의 상태를 표시
        if (record.Action) {
          return (
            <Tag color={getStatusColor(record.Action.status)}>
              {getStatusLabel(record.Action.status)}
            </Tag>
          );
        }

        // 액션 생성 전 워크플로우 상태
        return (
          <Tag
            color={
              record.isRecalled
                ? 'warning'
                : record.isApproved
                ? 'success'
                : getStatusColor(status)
            }
          >
            {record.isRecalled
              ? '회수됨'
              : record.isApproved
              ? '승인됨'
              : getStatusLabel(status)}
          </Tag>
        );
      },
    },
    {
      title: '요청자',
      key: 'requester',
      width: '10%',
      render: (_: any, record: WorkRequest) => {
        return record.Requester?.displayName || '-';
      },
    },
    {
      title: '담당자',
      key: 'assignee',
      width: '12%',
      render: (_: any, record: WorkRequest) => {
        // 개인 담당자가 있으면 개인 담당자 표시 (텍스트)
        if (record.Assignee) {
          return <span>{record.Assignee.displayName}</span>;
        }
        // 개인 담당자가 없고 팀 담당만 있으면 팀 표시 (Tag)
        if (record.AssigneeTeam) {
          return (
            <Tag icon={<TeamOutlined />} color="blue">
              {record.AssigneeTeam.name}
            </Tag>
          );
        }
        return '-';
      },
    },
    {
      title: '마감일',
      dataIndex: 'dueDate',
      key: 'dueDate',
      width: '10%',
      sorter: (a: WorkRequest, b: WorkRequest) => {
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return dayjs(a.dueDate).unix() - dayjs(b.dueDate).unix();
      },
      render: (date: string) => (date ? dayjs(date).format('YYYY-MM-DD') : '-'),
    },
    {
      title: '요청일',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: '15%',
      sorter: (a: WorkRequest, b: WorkRequest) => {
        return dayjs(a.createdAt).unix() - dayjs(b.createdAt).unix();
      },
      defaultSortOrder: 'descend' as const,
      render: (date: string) => dayjs(date).format('YYYY-MM-DD'),
    },
  ];

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          marginBottom: 16,
        }}
      >
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleCreate}
          size="large"
        >
          새 요청 등록
        </Button>
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={setActiveTab}
        tabBarExtraContent={
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {activeTab === 'sent' && (
              <Input
                prefix={<SearchOutlined />}
                placeholder="제목 검색"
                value={sentSearchText}
                onChange={(e) => setSentSearchText(e.target.value)}
                allowClear
                style={{ width: 300 }}
              />
            )}
            {activeTab === 'received' && (
              <>
                <Segmented
                  value={receivedFilter}
                  onChange={(value) => setReceivedFilter(value as 'all' | 'assigned' | 'team')}
                  options={[
                    { label: '전체', value: 'all' },
                    { label: '내 담당', value: 'assigned' },
                    { label: '팀 담당', value: 'team' },
                  ]}
                />
                <Input
                  prefix={<SearchOutlined />}
                  placeholder="제목 검색"
                  value={receivedSearchText}
                  onChange={(e) => setReceivedSearchText(e.target.value)}
                  allowClear
                  style={{ width: 300 }}
                />
              </>
            )}
            {activeTab === 'all' && (
              <Input
                prefix={<SearchOutlined />}
                placeholder="제목 검색"
                value={allSearchText}
                onChange={(e) => setAllSearchText(e.target.value)}
                allowClear
                style={{ width: 300 }}
              />
            )}
          </div>
        }
        items={[
          // Admin only tab - All Requests (first for admin)
          ...(user?.role === 'ADMIN'
            ? [
                {
                  key: 'all',
                  label: `모든 요청 (${allWorkRequests.length})`,
                  children: (
                    <Table
                      columns={columns}
                      dataSource={allWorkRequests.filter((wr) =>
                        wr.title.toLowerCase().includes(allSearchText.toLowerCase())
                      )}
                      rowKey="id"
                      loading={loading}
                      pagination={{ pageSize: 10 }}
                    />
                  ),
                },
              ]
            : []),
          {
            key: 'received',
            label: `받은 요청 (${assignedWorkRequests.length + teamWorkRequests.length})`,
            children: (
              <Table
                columns={columns}
                dataSource={(() => {
                  let data: WorkRequest[] = [];

                  // Segmented 필터에 따라 데이터 선택
                  if (receivedFilter === 'assigned') {
                    data = assignedWorkRequests;
                  } else if (receivedFilter === 'team') {
                    data = teamWorkRequests;
                  } else {
                    // 전체: assigned + team (중복 제거)
                    const allIds = new Set<string>();
                    data = [...assignedWorkRequests, ...teamWorkRequests].filter((wr) => {
                      if (allIds.has(wr.id)) return false;
                      allIds.add(wr.id);
                      return true;
                    });
                  }

                  // 제목 검색 필터 적용
                  return data.filter((wr) =>
                    wr.title.toLowerCase().includes(receivedSearchText.toLowerCase())
                  );
                })()}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
          {
            key: 'sent',
            label: `보낸 요청 (${myWorkRequests.length})`,
            children: (
              <Table
                columns={columns}
                dataSource={myWorkRequests.filter((wr) =>
                  wr.title.toLowerCase().includes(sentSearchText.toLowerCase())
                )}
                rowKey="id"
                loading={loading}
                pagination={{ pageSize: 10 }}
              />
            ),
          },
        ]}
      />

      <WorkRequestDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        workRequest={selectedWorkRequest}
        onSuccess={loadWorkRequests}
      />

      <Modal
        title={
          selectedWorkRequest && (
            <div style={{ paddingRight: 24, paddingBottom: 8 }}>
              {/* 제목 */}
              <div style={{
                fontSize: 22,
                fontWeight: 600,
                marginBottom: 16,
                color: '#262626',
                lineHeight: 1.4,
              }}>
                {selectedWorkRequest.title}
              </div>

              {/* PSTA 계층 태그 */}
              {(selectedWorkRequest.Project || selectedWorkRequest.Service || selectedWorkRequest.Team) && (
                <div style={{ marginBottom: 16 }}>
                  <Space size={10} wrap>
                    {selectedWorkRequest.Project && (
                      <Tag
                        icon={<FolderOutlined />}
                        color="#722ed1"
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          padding: '6px 14px',
                          borderRadius: 6,
                          border: 'none',
                          background: 'linear-gradient(135deg, #722ed1 0%, #9254de 100%)',
                          boxShadow: '0 2px 8px rgba(114, 46, 209, 0.25)',
                        }}
                      >
                        {selectedWorkRequest.Project.name}
                      </Tag>
                    )}
                    {selectedWorkRequest.Service && (
                      <Tag
                        icon={<AppstoreOutlined />}
                        color="#1890ff"
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          padding: '6px 14px',
                          borderRadius: 6,
                          border: 'none',
                          background: 'linear-gradient(135deg, #1890ff 0%, #40a9ff 100%)',
                          boxShadow: '0 2px 8px rgba(24, 144, 255, 0.25)',
                        }}
                      >
                        {selectedWorkRequest.Service.name}
                      </Tag>
                    )}
                    {selectedWorkRequest.Team && (
                      <Tag
                        icon={<TeamOutlined />}
                        color="#52c41a"
                        style={{
                          fontSize: 13,
                          fontWeight: 500,
                          padding: '6px 14px',
                          borderRadius: 6,
                          border: 'none',
                          background: 'linear-gradient(135deg, #52c41a 0%, #73d13d 100%)',
                          boxShadow: '0 2px 8px rgba(82, 196, 26, 0.25)',
                        }}
                      >
                        {selectedWorkRequest.Team.name}
                      </Tag>
                    )}
                  </Space>
                </div>
              )}

              {/* 우선순위와 상태 태그 */}
              <div style={{
                paddingTop: 12,
                borderTop: '1px solid #f0f0f0',
              }}>
                <Space size={16} wrap align="center">
                  {/* 우선순위 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 13,
                      color: '#8c8c8c',
                      fontWeight: 500,
                    }}>
                      우선순위
                    </span>
                    <Tag
                      color={getPriorityColor(selectedWorkRequest.priority)}
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        padding: '6px 14px',
                        borderRadius: 6,
                        border: 'none',
                        margin: 0,
                      }}
                    >
                      {getPriorityLabel(selectedWorkRequest.priority)}
                    </Tag>
                  </div>

                  {/* 상태 */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      fontSize: 13,
                      color: '#8c8c8c',
                      fontWeight: 500,
                    }}>
                      상태
                    </span>
                    <Tag
                      color={
                        selectedWorkRequest.Action
                          ? getStatusColor(selectedWorkRequest.Action.status)
                          : selectedWorkRequest.isRecalled
                          ? 'warning'
                          : selectedWorkRequest.isApproved
                          ? 'success'
                          : getStatusColor(selectedWorkRequest.status)
                      }
                      style={{
                        fontSize: 13,
                        fontWeight: 500,
                        padding: '6px 14px',
                        borderRadius: 6,
                        border: 'none',
                        margin: 0,
                      }}
                    >
                      {selectedWorkRequest.Action
                        ? getStatusLabel(selectedWorkRequest.Action.status)
                        : selectedWorkRequest.isRecalled
                        ? '회수됨'
                        : selectedWorkRequest.isApproved
                        ? '승인됨'
                        : getStatusLabel(selectedWorkRequest.status)}
                    </Tag>
                  </div>
                </Space>
              </div>

              {/* 상세 설명 */}
              <div style={{
                marginTop: 20,
                padding: '16px',
                background: 'linear-gradient(135deg, #fafafa 0%, #f5f5f5 100%)',
                borderRadius: 8,
                border: '1px solid #e8e8e8',
              }}>
                <div style={{
                  fontSize: 12,
                  color: '#8c8c8c',
                  fontWeight: 500,
                  marginBottom: 8,
                  letterSpacing: '0.5px',
                }}>
                  상세 설명
                </div>
                <div
                  className="description-html-view"
                  style={{ fontSize: 14, color: '#262626' }}
                  dangerouslySetInnerHTML={{ __html: selectedWorkRequest.description }}
                />
              </div>

              {/* 반려 사유 */}
              {selectedWorkRequest.status === WorkRequestStatus.REJECTED && selectedWorkRequest.rejectionMessage && (
                <div style={{
                  marginTop: 20,
                  padding: '16px',
                  background: 'linear-gradient(135deg, #fff2e8 0%, #ffebe0 100%)',
                  borderRadius: 8,
                  border: '1px solid #ffbb96',
                }}>
                  <div style={{
                    fontSize: 12,
                    color: '#d4380d',
                    fontWeight: 600,
                    marginBottom: 8,
                    letterSpacing: '0.5px',
                  }}>
                    ❌ 반려 사유
                  </div>
                  <div style={{
                    fontSize: 14,
                    color: '#262626',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {selectedWorkRequest.rejectionMessage}
                  </div>
                </div>
              )}

              {/* 협의 메시지 */}
              {selectedWorkRequest.status === WorkRequestStatus.IN_NEGOTIATION && selectedWorkRequest.negotiationMessage && (
                <div style={{
                  marginTop: 20,
                  padding: '16px',
                  background: 'linear-gradient(135deg, #fffbe6 0%, #fff7e0 100%)',
                  borderRadius: 8,
                  border: '1px solid #ffe58f',
                }}>
                  <div style={{
                    fontSize: 12,
                    color: '#d48806',
                    fontWeight: 600,
                    marginBottom: 8,
                    letterSpacing: '0.5px',
                  }}>
                    💬 협의 요청 내용
                  </div>
                  <div style={{
                    fontSize: 14,
                    color: '#262626',
                    lineHeight: 1.6,
                    whiteSpace: 'pre-wrap',
                  }}>
                    {selectedWorkRequest.negotiationMessage}
                  </div>
                </div>
              )}
            </div>
          )
        }
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        width={800}
        footer={(() => {
          if (!selectedWorkRequest || !user) return null;

          const isRequester = user.id === selectedWorkRequest.requesterId;
          const isAssignee = user.id === selectedWorkRequest.assigneeId;
          const buttons = [];

          // 닫기 버튼 (모든 사용자)
          buttons.push(
            <Button key="close" onClick={() => setDetailModalOpen(false)}>
              닫기
            </Button>
          );

          // 작업자 할당 버튼 (PM/PO만, 팀 할당 + 개인 미할당인 경우)
          if (canAssign(selectedWorkRequest)) {
            buttons.push(
              <Button
                key="assign"
                type="primary"
                icon={<UserAddOutlined />}
                onClick={() => {
                  setDetailModalOpen(false);
                  handleOpenAssignModal(selectedWorkRequest);
                }}
              >
                작업자 할당
              </Button>
            );
          }

          // 담당자 버튼
          if (isAssignee && !selectedWorkRequest.isRecalled) {
            // 승인, 반려, 협의 버튼 (미승인 상태이고, 반려/협의중이 아닌 경우에만)
            if (
              !selectedWorkRequest.isApproved &&
              selectedWorkRequest.status !== WorkRequestStatus.REJECTED &&
              selectedWorkRequest.status !== WorkRequestStatus.IN_NEGOTIATION
            ) {
              // 승인 버튼
              buttons.push(
                <Popconfirm
                  key="approve"
                  title="작업 요청을 승인하시겠습니까?"
                  onConfirm={() => {
                    setDetailModalOpen(false);
                    handleApprove(selectedWorkRequest.id);
                  }}
                  okText="승인"
                  cancelText="취소"
                >
                  <Button type="primary">승인</Button>
                </Popconfirm>
              );

              // 반려 버튼
              buttons.push(
                <Button
                  key="reject"
                  danger
                  icon={<CloseCircleOutlined />}
                  onClick={() => {
                    setRejectModalOpen(true);
                  }}
                >
                  반려
                </Button>
              );

              // 협의 버튼
              buttons.push(
                <Button
                  key="negotiate"
                  icon={<MessageOutlined />}
                  onClick={() => {
                    setNegotiationModalOpen(true);
                  }}
                >
                  협의
                </Button>
              );

              // 전달 버튼
              buttons.push(
                <Button
                  key="forward"
                  icon={<ArrowRightOutlined />}
                  onClick={handleOpenForwardModal}
                >
                  전달
                </Button>
              );
            }

            // 취소 버튼 (협의중 또는 반려 상태인 경우에만)
            if (
              selectedWorkRequest.status === WorkRequestStatus.IN_NEGOTIATION ||
              selectedWorkRequest.status === WorkRequestStatus.REJECTED
            ) {
              buttons.push(
                <Popconfirm
                  key="cancel"
                  title="작업 요청을 취소하시겠습니까?"
                  description="취소된 요청은 더 이상 진행되지 않습니다."
                  onConfirm={handleCancel}
                  okText="취소 처리"
                  cancelText="닫기"
                  okButtonProps={{ danger: true, loading: cancelling }}
                >
                  <Button danger icon={<CloseCircleOutlined />}>
                    취소 처리
                  </Button>
                </Popconfirm>
              );
            }

            // 액션 생성 버튼
            if (selectedWorkRequest.isApproved && !selectedWorkRequest.actionId) {
              buttons.push(
                <Button
                  key="create-action"
                  type="primary"
                  onClick={handleCreateAction}
                >
                  액션 생성
                </Button>
              );
            }

            // 서비스 생성 버튼 (PM/PO만, 프로젝트는 있지만 서비스가 없을 때)
            if (
              (user.role === 'PM' || user.role === 'PO') &&
              selectedWorkRequest.isApproved &&
              !selectedWorkRequest.actionId &&
              selectedWorkRequest.projectId &&
              !selectedWorkRequest.serviceId
            ) {
              buttons.push(
                <Button
                  key="create-service"
                  onClick={handleOpenServiceCreate}
                >
                  서비스 생성
                </Button>
              );
            }

            // 팀 할당 버튼 (PM/PO만, 서비스는 있지만 팀이 없을 때)
            if (
              (user.role === 'PM' || user.role === 'PO') &&
              selectedWorkRequest.isApproved &&
              !selectedWorkRequest.actionId &&
              selectedWorkRequest.serviceId &&
              !selectedWorkRequest.teamId
            ) {
              buttons.push(
                <Button
                  key="assign-team"
                  onClick={handleOpenTeamAssign}
                >
                  팀 할당
                </Button>
              );
            }

            // 승인 취소 버튼 (승인된 상태, 액션 미생성, 승인한 당사자만)
            if (
              selectedWorkRequest.isApproved &&
              !selectedWorkRequest.actionId &&
              selectedWorkRequest.approvedById === user.id
            ) {
              buttons.push(
                <Popconfirm
                  key="unapprove"
                  title="승인을 취소하시겠습니까?"
                  description="승인을 취소하면 대기 상태로 돌아갑니다."
                  onConfirm={() => {
                    handleUnapprove(selectedWorkRequest.id);
                  }}
                  okText="승인 취소"
                  cancelText="닫기"
                  okButtonProps={{ danger: true }}
                >
                  <Button danger icon={<RollbackOutlined />}>
                    승인 취소
                  </Button>
                </Popconfirm>
              );
            }
          }

          // 요청자 버튼
          if (isRequester) {
            // 반려 또는 협의중 상태인 경우: 수정 및 재요청 버튼 표시
            if (
              selectedWorkRequest.status === WorkRequestStatus.REJECTED ||
              selectedWorkRequest.status === WorkRequestStatus.IN_NEGOTIATION
            ) {
              // 수정 버튼
              buttons.push(
                <Button
                  key="edit"
                  type="primary"
                  icon={<EditOutlined />}
                  onClick={() => {
                    setDetailModalOpen(false);
                    setDrawerOpen(true);
                  }}
                >
                  내용 수정
                </Button>
              );

              // 재요청 버튼
              buttons.push(
                <Popconfirm
                  key="resubmit"
                  title="작업 요청을 재요청하시겠습니까?"
                  description="현재 내용으로 다시 담당자에게 요청됩니다."
                  onConfirm={() => {
                    handleResubmit(selectedWorkRequest.id);
                  }}
                  okText="재요청"
                  cancelText="취소"
                >
                  <Button type="primary" icon={<ArrowRightOutlined />}>
                    재요청
                  </Button>
                </Popconfirm>
              );
            } else {
              // 삭제 버튼
              buttons.push(
                <Popconfirm
                  key="delete"
                  title="정말 삭제하시겠습니까?"
                  onConfirm={() => {
                    setDetailModalOpen(false);
                    handleDelete(selectedWorkRequest.id);
                  }}
                  okText="삭제"
                  cancelText="취소"
                >
                  <Button danger icon={<DeleteOutlined />}>
                    삭제
                  </Button>
                </Popconfirm>
              );

              // 수정 버튼 (회수된 경우에만)
              if (selectedWorkRequest.isRecalled) {
                buttons.push(
                  <Button
                    key="edit"
                    type="primary"
                    icon={<EditOutlined />}
                    onClick={() => {
                      setDetailModalOpen(false);
                      setDrawerOpen(true);
                    }}
                  >
                    수정
                  </Button>
                );
              }

              // 회수 버튼 (회수되지 않은 경우에만)
              if (!selectedWorkRequest.isRecalled && !selectedWorkRequest.isApproved) {
                buttons.push(
                  <Popconfirm
                    key="recall"
                    title="작업 요청을 회수하시겠습니까?"
                    description="회수 후 수정할 수 있습니다."
                    onConfirm={() => {
                      setDetailModalOpen(false);
                      handleRecall(selectedWorkRequest.id);
                    }}
                    okText="회수"
                    cancelText="취소"
                  >
                    <Button icon={<RollbackOutlined />}>회수</Button>
                  </Popconfirm>
                );
              }
            }
          }

          // 관리자 강제 삭제 버튼 (액션이 없고, 요청자가 아닌 경우에만)
          if (user.role === 'ADMIN' && !isRequester && !selectedWorkRequest.actionId) {
            buttons.push(
              <Popconfirm
                key="admin-delete"
                title="관리자 권한으로 삭제하시겠습니까?"
                description="이 작업은 되돌릴 수 없습니다."
                onConfirm={() => handleAdminDelete(selectedWorkRequest.id)}
                okText="삭제"
                cancelText="취소"
                okButtonProps={{ danger: true }}
              >
                <Button danger icon={<DeleteOutlined />}>
                  관리자 삭제
                </Button>
              </Popconfirm>
            );
          }

          return buttons;
        })()}
      >
        {selectedWorkRequest && (
          <div style={{
            padding: '24px',
            background: '#fafafa',
            borderRadius: 8,
            marginTop: -8,
          }}>
            <div style={{
              fontSize: 13,
              color: '#8c8c8c',
              fontWeight: 600,
              marginBottom: 16,
              letterSpacing: '0.5px',
              textTransform: 'uppercase',
            }}>
              요청 정보
            </div>
            <Descriptions column={2} bordered style={{ background: 'white' }}>
              <Descriptions.Item label="요청자">
                {selectedWorkRequest.Requester?.displayName || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="담당자">
                {selectedWorkRequest.AssigneeTeam
                  ? `팀: ${selectedWorkRequest.AssigneeTeam.name}`
                  : selectedWorkRequest.Assignee?.displayName || '-'}
              </Descriptions.Item>
              {selectedWorkRequest.isApproved && (
                <>
                  <Descriptions.Item label="승인자">
                    {selectedWorkRequest.ApprovedBy?.displayName || '-'}
                  </Descriptions.Item>
                  <Descriptions.Item label="승인일">
                    {selectedWorkRequest.approvedAt
                      ? dayjs(selectedWorkRequest.approvedAt).format('YYYY-MM-DD HH:mm')
                      : '-'}
                  </Descriptions.Item>
                </>
              )}
              <Descriptions.Item label="마감일">
                {selectedWorkRequest.dueDate
                  ? dayjs(selectedWorkRequest.dueDate).format('YYYY-MM-DD')
                  : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="요청일">
                {dayjs(selectedWorkRequest.createdAt).format('YYYY-MM-DD HH:mm')}
              </Descriptions.Item>
            </Descriptions>

            {/* 연결된 액션 정보 */}
            {selectedWorkRequest.Action && (
              <>
                <div style={{
                  fontSize: 13,
                  color: '#8c8c8c',
                  fontWeight: 600,
                  marginTop: 24,
                  marginBottom: 16,
                  letterSpacing: '0.5px',
                  textTransform: 'uppercase',
                }}>
                  연결된 액션
                </div>
                <div
                  style={{
                    background: 'white',
                    borderRadius: 8,
                    padding: 20,
                    border: '1px solid #d9d9d9',
                    cursor: 'pointer',
                    transition: 'all 0.3s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#1890ff';
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(24, 144, 255, 0.15)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#d9d9d9';
                    e.currentTarget.style.boxShadow = 'none';
                  }}
                  onClick={() => handleGoToAction(selectedWorkRequest.Action!.id)}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                    {/* 액션 아이콘 */}
                    <div style={{
                      width: 48,
                      height: 48,
                      borderRadius: 8,
                      background: 'linear-gradient(135deg, #fa8c16 0%, #ffa940 100%)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      boxShadow: '0 2px 8px rgba(250, 140, 22, 0.25)',
                    }}>
                      <CheckCircleOutlined style={{ fontSize: 24, color: 'white' }} />
                    </div>

                    {/* 액션 정보 */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 16,
                        fontWeight: 600,
                        color: '#262626',
                        marginBottom: 8,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {selectedWorkRequest.Action.name}
                      </div>

                      <Space size={12} wrap>
                        <Tag
                          color={getStatusColor(selectedWorkRequest.Action.status)}
                          style={{
                            fontSize: 12,
                            fontWeight: 500,
                            padding: '4px 10px',
                            borderRadius: 4,
                            border: 'none',
                          }}
                        >
                          {getStatusLabel(selectedWorkRequest.Action.status)}
                        </Tag>

                        <span style={{ fontSize: 13, color: '#595959' }}>
                          진행률: <strong>{selectedWorkRequest.Action.progress}%</strong>
                        </span>

                        {selectedWorkRequest.Action.User_Item_assigneeIdToUser && (
                          <span style={{ fontSize: 13, color: '#595959' }}>
                            담당자: <strong>{selectedWorkRequest.Action.User_Item_assigneeIdToUser.displayName}</strong>
                          </span>
                        )}
                      </Space>

                      {selectedWorkRequest.Action.description && (
                        <div
                          className="description-html-view"
                          style={{
                            marginTop: 12,
                            fontSize: 13,
                            color: '#8c8c8c',
                            lineHeight: 1.5,
                            display: '-webkit-box',
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: 'vertical',
                            overflow: 'hidden',
                          }}
                          dangerouslySetInnerHTML={{ __html: selectedWorkRequest.Action.description }}
                        />
                      )}
                    </div>

                    {/* 바로가기 아이콘 */}
                    <div style={{
                      width: 32,
                      height: 32,
                      borderRadius: 6,
                      background: '#f0f0f0',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                      transition: 'all 0.3s',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = '#1890ff';
                      const icon = e.currentTarget.querySelector('.arrow-icon') as HTMLElement;
                      if (icon) icon.style.color = 'white';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = '#f0f0f0';
                      const icon = e.currentTarget.querySelector('.arrow-icon') as HTMLElement;
                      if (icon) icon.style.color = '#595959';
                    }}>
                      <ArrowRightOutlined className="arrow-icon" style={{ fontSize: 16, color: '#595959', transition: 'all 0.3s' }} />
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* 작업 할당 Modal */}
      <Modal
        title="작업 할당"
        open={assignModalOpen}
        onOk={handleAssign}
        onCancel={() => {
          setAssignModalOpen(false);
          setSelectedAssignee(undefined);
        }}
        okText="할당"
        cancelText="취소"
        confirmLoading={assigning}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>작업 요청</div>
          <div>{selectedWorkRequest?.title}</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>담당 팀</div>
          <div>{selectedWorkRequest?.AssigneeTeam?.name}</div>
        </div>

        <div>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>
            담당자 선택 <span style={{ color: 'red' }}>*</span>
          </div>
          <Select
            style={{ width: '100%' }}
            placeholder="팀 멤버 선택"
            value={selectedAssignee}
            onChange={setSelectedAssignee}
            showSearch
            filterOption={(input, option) =>
              String(option?.children || '').toLowerCase().includes(input.toLowerCase())
            }
          >
            {teamMembers.map((member) => (
              <Select.Option key={member.id} value={member.id}>
                {member.displayName} ({member.username}) - {member.role}
              </Select.Option>
            ))}
          </Select>
        </div>
      </Modal>

      {/* 반려 Modal */}
      <Modal
        title="작업 요청 반려"
        open={rejectModalOpen}
        onOk={handleReject}
        onCancel={() => {
          setRejectModalOpen(false);
          setRejectionMessage('');
        }}
        okText="반려"
        cancelText="취소"
        confirmLoading={rejecting}
        okButtonProps={{ danger: true }}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>작업 요청</div>
          <div>{selectedWorkRequest?.title}</div>
        </div>

        <div>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>
            반려 사유 (선택사항)
          </div>
          <TextArea
            rows={4}
            placeholder="반려 사유를 입력하세요. (선택사항)"
            value={rejectionMessage}
            onChange={(e) => setRejectionMessage(e.target.value)}
          />
        </div>
      </Modal>

      {/* 협의 요청 Modal */}
      <Modal
        title="협의 요청"
        open={negotiationModalOpen}
        onOk={handleNegotiate}
        onCancel={() => {
          setNegotiationModalOpen(false);
          setNegotiationMessage('');
        }}
        okText="협의 요청"
        cancelText="취소"
        confirmLoading={negotiating}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>작업 요청</div>
          <div>{selectedWorkRequest?.title}</div>
        </div>

        <div>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>
            협의 내용 <span style={{ color: 'red' }}>*</span>
          </div>
          <TextArea
            rows={4}
            placeholder="기간 변경, 작업 내용 수정 등 협의가 필요한 내용을 입력하세요."
            value={negotiationMessage}
            onChange={(e) => setNegotiationMessage(e.target.value)}
          />
          <div style={{ marginTop: 8, color: '#8c8c8c', fontSize: 12 }}>
            요청자에게 협의 메시지가 전송되며, 작업 요청 상태가 '협의중'으로 변경됩니다.
          </div>
        </div>
      </Modal>

      {/* 계층 구조 요청 Modal */}
      {hierarchyModalOpen && selectedWorkRequest && validationResult && (
        <HierarchyRequestModal
          open={hierarchyModalOpen}
          onClose={() => {
            setHierarchyModalOpen(false);
            setValidationResult(null);
          }}
          workRequest={selectedWorkRequest}
          validationResult={validationResult}
          onSuccess={async () => {
            message.success('계층 구조 요청이 완료되었습니다');
            setHierarchyModalOpen(false);
            setValidationResult(null);
            await loadWorkRequests();
            // 재검증하여 모든 계층이 완료되었는지 확인
            const revalidation = await workRequestsApi.validateActionCreation(selectedWorkRequest.id);
            if (revalidation.canCreateAction) {
              // 이제 액션 생성 가능
              message.info('모든 계층이 준비되었습니다. 액션 생성을 진행할 수 있습니다.');
            }
          }}
        />
      )}

      {/* 서비스 생성 Modal */}
      <Modal
        title="서비스 생성"
        open={serviceCreateModalOpen}
        onOk={handleServiceCreate}
        onCancel={() => {
          setServiceCreateModalOpen(false);
          setServiceName('');
          setServiceDescription('');
        }}
        okText="생성"
        cancelText="취소"
        confirmLoading={creatingService}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>작업 요청</div>
          <div>{selectedWorkRequest?.title}</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>상위 프로젝트</div>
          <div>{selectedWorkRequest?.Project?.name}</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>
            서비스 이름 <span style={{ color: 'red' }}>*</span>
          </div>
          <Input
            placeholder="서비스 이름을 입력하세요"
            value={serviceName}
            onChange={(e) => setServiceName(e.target.value)}
          />
        </div>

        <div>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>서비스 설명 (선택사항)</div>
          <TextArea
            rows={4}
            placeholder="서비스에 대한 설명을 입력하세요"
            value={serviceDescription}
            onChange={(e) => setServiceDescription(e.target.value)}
          />
        </div>
      </Modal>

      {/* 팀 할당 Modal */}
      <Modal
        title="팀 할당"
        open={teamAssignModalOpen}
        onOk={handleTeamAssign}
        onCancel={() => {
          setTeamAssignModalOpen(false);
          setSelectedTeamId(undefined);
        }}
        okText="할당"
        cancelText="취소"
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>작업 요청</div>
          <div>{selectedWorkRequest?.title}</div>
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>상위 서비스</div>
          <div>{selectedWorkRequest?.Service?.name}</div>
        </div>

        <div>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>
            팀 선택 <span style={{ color: 'red' }}>*</span>
          </div>
          <Select
            style={{ width: '100%' }}
            placeholder="팀을 선택하세요"
            value={selectedTeamId}
            onChange={setSelectedTeamId}
            showSearch
            filterOption={(input, option) =>
              String(option?.children || '').toLowerCase().includes(input.toLowerCase())
            }
          >
            {availableTeams.map((team) => (
              <Select.Option key={team.id} value={team.id}>
                {team.name}
              </Select.Option>
            ))}
          </Select>
        </div>
      </Modal>

      {/* 전달 Modal */}
      <Modal
        title="작업 요청 전달"
        open={forwardModalOpen}
        onOk={handleForward}
        onCancel={() => {
          setForwardModalOpen(false);
          setSelectedForwardUser(undefined);
        }}
        okText="전달"
        cancelText="취소"
        confirmLoading={forwarding}
      >
        <div style={{ marginBottom: 16 }}>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>작업 요청</div>
          <div>{selectedWorkRequest?.title}</div>
        </div>

        <div>
          <div style={{ marginBottom: 8, fontWeight: 600 }}>
            전달받을 사용자 <span style={{ color: 'red' }}>*</span>
          </div>
          <Select
            style={{ width: '100%' }}
            placeholder="사용자를 선택하세요"
            value={selectedForwardUser}
            onChange={setSelectedForwardUser}
            showSearch
            filterOption={(input, option) =>
              String(option?.children || '').toLowerCase().includes(input.toLowerCase())
            }
          >
            {forwardUsers.map((user) => (
              <Select.Option key={user.id} value={user.id}>
                {user.displayName} ({user.username})
              </Select.Option>
            ))}
          </Select>
        </div>
      </Modal>
    </div>
  );
};
