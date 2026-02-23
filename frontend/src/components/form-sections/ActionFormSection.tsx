import React from 'react';
import { Form, Select, Row, Col, InputNumber, Tag } from 'antd';
import type { FormInstance } from 'antd/es/form';
import { Item, ItemStatus } from '../../types';

interface ActionFormSectionProps {
  isEditing: boolean;
  item?: Item | null;
  projects: any[];
  filteredServices: Item[];
  filteredTeams: Item[];
  selectedProjectId?: string;
  selectedServiceId?: string;
  enableHierarchyEdit?: boolean;
  onProjectChange: (projectId: string) => void;
  onServiceChange: (serviceId: string) => void;
  form?: FormInstance;
}

const statusLabels: Record<string, string> = {
  NOT_STARTED: '시작 전',
  IN_PROGRESS: '진행중',
  COMPLETED: '완료',
  ON_HOLD: '보류',
};

const statusColors: Record<string, string> = {
  NOT_STARTED: 'default',
  IN_PROGRESS: 'processing',
  COMPLETED: 'success',
  ON_HOLD: 'warning',
};

export const ActionFormSection: React.FC<ActionFormSectionProps> = ({
  isEditing,
  item,
  projects,
  filteredServices,
  filteredTeams,
  selectedProjectId,
  selectedServiceId,
  enableHierarchyEdit = false,
  onProjectChange,
  onServiceChange,
  form,
}) => {
  // 상태 변경 시 진행률 자동 연동
  const handleStatusChange = (value: string) => {
    if (!form) return;
    if (value === ItemStatus.NOT_STARTED) {
      form.setFieldsValue({ progress: 0 });
    } else if (value === ItemStatus.COMPLETED) {
      form.setFieldsValue({ progress: 100 });
    }
    // 진행중/보류는 기존 진행률 유지
  };

  // 진행률 변경 시 상태 자동 연동
  const handleProgressChange = (value: number | null) => {
    if (!form) return;
    if (value === 0) {
      form.setFieldsValue({ status: ItemStatus.NOT_STARTED });
    } else if (value === 100) {
      form.setFieldsValue({ status: ItemStatus.COMPLETED });
    } else if (value !== null && value > 0 && value < 100) {
      const currentStatus = form.getFieldValue('status');
      // 보류 상태가 아닐 때만 진행중으로 변경
      if (currentStatus !== ItemStatus.ON_HOLD) {
        form.setFieldsValue({ status: ItemStatus.IN_PROGRESS });
      }
    }
  };
  // 프로젝트명 찾기
  const getProjectName = () => {
    if (selectedProjectId) {
      const project = projects.find(p => p.id === selectedProjectId);
      return project?.name || '-';
    }
    return (item as any)?.Item?.Item?.name || '-';
  };

  // 서비스명 찾기
  const getServiceName = () => {
    if (selectedServiceId) {
      const service = filteredServices.find(s => s.id === selectedServiceId);
      return service?.name || '-';
    }
    return (item as any)?.Item?.name || '-';
  };

  // 팀명
  const getTeamName = () => {
    return (item as any)?.User_Item_createdByIdToUser?.Team?.name || '-';
  };

  return (
    <>
      {/* 계층 선택 (enableHierarchyEdit=true) */}
      {enableHierarchyEdit && (
        <>
          <Form.Item label="프로젝트" rules={isEditing ? [{ required: true, message: '프로젝트를 선택해주세요' }] : []}>
            {isEditing ? (
              <Select
                size="large"
                placeholder="프로젝트를 선택해주세요"
                value={selectedProjectId}
                onChange={onProjectChange}
              >
                {projects.map((project) => (
                  <Select.Option key={project.id} value={project.id}>
                    {project.name}
                  </Select.Option>
                ))}
              </Select>
            ) : (
              <div className="view-field">{getProjectName()}</div>
            )}
          </Form.Item>

          <Form.Item label="서비스" rules={isEditing ? [{ required: true, message: '서비스를 선택해주세요' }] : []}>
            {isEditing ? (
              <Select
                size="large"
                placeholder="서비스를 선택해주세요"
                value={selectedServiceId}
                onChange={onServiceChange}
                disabled={!selectedProjectId}
              >
                {filteredServices.map((service) => (
                  <Select.Option key={service.id} value={service.id}>
                    {service.name}
                  </Select.Option>
                ))}
              </Select>
            ) : (
              <div className="view-field">{getServiceName()}</div>
            )}
          </Form.Item>

          <Form.Item label="팀 (생성자)">
            <div className="view-field view-field-readonly">{getTeamName()}</div>
          </Form.Item>
        </>
      )}

      {/* 계층 정보 조회 (enableHierarchyEdit=false) - 3단계 구조 */}
      {!enableHierarchyEdit && item && (
        <>
          <Form.Item label="프로젝트">
            <div className="view-field view-field-readonly">{(item as any)?.Item?.Item?.name || '-'}</div>
          </Form.Item>

          <Form.Item label="서비스">
            <div className="view-field view-field-readonly">{(item as any)?.Item?.name || '-'}</div>
          </Form.Item>

          <Form.Item label="팀 (생성자)">
            <div className="view-field view-field-readonly">{getTeamName()}</div>
          </Form.Item>
        </>
      )}

      {/* 상태 + 진행률 (자동 연동) */}
      <Row gutter={16}>
        <Col span={12}>
          <Form.Item name="status" label="상태">
            {isEditing ? (
              <Select size="large" onChange={handleStatusChange}>
                <Select.Option value={ItemStatus.NOT_STARTED}>시작 전</Select.Option>
                <Select.Option value={ItemStatus.IN_PROGRESS}>진행중</Select.Option>
                <Select.Option value={ItemStatus.COMPLETED}>완료</Select.Option>
                <Select.Option value={ItemStatus.ON_HOLD}>보류</Select.Option>
              </Select>
            ) : (
              <div className="view-field">
                <Tag color={statusColors[item?.status || 'NOT_STARTED']}>
                  {statusLabels[item?.status || 'NOT_STARTED']}
                </Tag>
              </div>
            )}
          </Form.Item>
        </Col>

        <Col span={12}>
          <Form.Item name="progress" label="진행률 (%)">
            {isEditing ? (
              <InputNumber min={0} max={100} style={{ width: '100%' }} size="large" onChange={handleProgressChange} />
            ) : (
              <div className="view-field">{item?.progress ?? 0}%</div>
            )}
          </Form.Item>
        </Col>
      </Row>
    </>
  );
};
