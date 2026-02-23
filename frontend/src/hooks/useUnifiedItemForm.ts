import { useState, useEffect } from 'react';
import { FormInstance } from 'antd/es/form';
import { Item, ItemType } from '../types';
import { itemsApi } from '../api/items';
import { useItemForm } from './useItemForm';
import { useAuthStore } from '../store/authStore';

interface UseUnifiedItemFormOptions {
  form: FormInstance;
  item?: Item | null;
  initialEditMode?: boolean;
  // SERVICE 타입 옵션
  clients?: any[];
  projects?: any[];
  // ACTION 타입 옵션
  services?: any[];
  teams?: any[];
  enableHierarchyEdit?: boolean;
}

export const useUnifiedItemForm = ({
  form,
  item,
  initialEditMode,
  clients = [],
  projects = [],
  services = [],
  teams = [],
  enableHierarchyEdit = false,
}: UseUnifiedItemFormOptions) => {
  const baseForm = useItemForm(form, item, initialEditMode);
  const user = useAuthStore((state) => state.user);

  // SERVICE 타입 상태
  const [availableProjects, setAvailableProjects] = useState<Item[]>(projects);

  // ACTION 타입 상태
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [selectedServiceId, setSelectedServiceId] = useState<string | undefined>();
  const [filteredServices, setFilteredServices] = useState<Item[]>([]);
  const [filteredTeams, setFilteredTeams] = useState<Item[]>([]);

  // projects prop이 변경되면 availableProjects 업데이트 (v1.1.18)
  useEffect(() => {
    if (projects && projects.length > 0) {
      setAvailableProjects(projects);
    }
  }, [projects]);

  // SERVICE 타입 전용 로직
  useEffect(() => {
    if (item && item.type === ItemType.SERVICE) {
      // 서비스의 clientId로 프로젝트 목록 로드
      if (item.clientId) {
        loadProjects(item.clientId);
      } else if (item.parentId && projects.length > 0) {
        // clientId가 없지만 parentId가 있으면 전체 projects에서 찾기
        const parentProject = projects.find((p: any) => p.id === item.parentId);
        if (parentProject) {
          setAvailableProjects([parentProject]);
        }
      }
    }
  }, [item, projects]);

  // ACTION 타입 전용 로직 (3단계 구조: parentId → 서비스 → 프로젝트)
  useEffect(() => {
    if (item && item.type === ItemType.ACTION) {
      // 계층 정보 복원 - Item(parentId) 관계에서 서비스/프로젝트 정보 추출
      if (enableHierarchyEdit) {
        const itemAny = item as any;
        const service = itemAny.Item; // parentId가 가리키는 서비스

        if (service) {
          const serviceId = service.id;
          const projectId = service.parentId;

          // 상태 설정
          setSelectedProjectId(projectId);
          setSelectedServiceId(serviceId);

          // 서비스 목록 필터링
          const filtered = services.filter((s: Item) => s.parentId === projectId);
          setFilteredServices(filtered);

          // 팀 목록 필터링
          const filteredT = teams.filter((t: Item) => t.parentId === serviceId);
          setFilteredTeams(filteredT);
        }
      }
    }
  }, [item, enableHierarchyEdit, services, teams]);

  // SERVICE: 프로젝트 목록 로드
  const loadProjects = async (clientId: string) => {
    try {
      const data = await itemsApi.getItems({ type: ItemType.PROJECT, clientId });
      setAvailableProjects(data);
    } catch (error) {
      console.error('Failed to load projects:', error);
      setAvailableProjects([]);
    }
  };

  // SERVICE: 고객 변경 핸들러
  const handleClientChange = (clientId: string) => {
    loadProjects(clientId);
    form.setFieldsValue({ parentId: undefined });
  };

  // SERVICE: 프로젝트 변경 핸들러
  const handleProjectChange = (projectId: string) => {
    if (item?.type === ItemType.SERVICE) {
      // SERVICE 타입: clientId 자동 설정
      const selectedProject = availableProjects.find((p) => p.id === projectId);
      if (selectedProject) {
        form.setFieldsValue({ clientId: selectedProject.clientId });
      }
    } else if (item?.type === ItemType.ACTION) {
      // ACTION 타입: 서비스 목록 필터링
      setSelectedProjectId(projectId);
      setSelectedServiceId(undefined);
      setFilteredServices(services.filter((s: Item) => s.parentId === projectId));
      setFilteredTeams([]);
      form.setFieldsValue({ parentId: undefined });
    }
  };

  // ACTION: 서비스 변경 핸들러 (3단계 구조)
  const handleServiceChange = async (serviceId: string) => {
    setSelectedServiceId(serviceId);
    setFilteredTeams(teams.filter((t: Item) => t.parentId === serviceId));

    // 3단계 구조: parentId에 서비스 ID 직접 설정
    form.setFieldsValue({ parentId: serviceId });
  };

  return {
    ...baseForm,
    // SERVICE 타입 속성
    availableProjects,
    loadProjects,
    // ACTION 타입 속성
    selectedProjectId,
    setSelectedProjectId,
    selectedServiceId,
    setSelectedServiceId,
    filteredServices,
    setFilteredServices,
    filteredTeams,
    setFilteredTeams,
    // 공통 핸들러
    handleClientChange,
    handleProjectChange,
    handleServiceChange,
  };
};
