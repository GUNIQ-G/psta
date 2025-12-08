import React, { useMemo } from 'react';
import { Modal, Tabs, Form, Select, Alert, Space, Tag, Input, Checkbox, Typography, Empty } from 'antd';
import { SearchOutlined, ThunderboltOutlined, ClockCircleOutlined, RightOutlined } from '@ant-design/icons';
import { Item, ItemType } from '../types';
import { RecentMoveLocation } from '../utils/recentMoves';

const { Text } = Typography;

interface ItemMoveModalProps {
  open: boolean;
  item: Item | null;
  moveMode: 'quick' | 'search';
  searchText: string;
  showMyTeamOnly: boolean;
  moveTargetProjects: Item[];
  moveTargetServices: Item[];
  moveServiceTeams: any[];
  moveSelectedProjectId?: string;
  moveSelectedServiceId?: string;
  selectedServiceTeamId?: string;
  recentMoves: RecentMoveLocation[];
  userTeamId?: string;
  onModeChange: (mode: 'quick' | 'search') => void;
  onSearchChange: (text: string) => void;
  onShowMyTeamOnlyChange: (checked: boolean) => void;
  onProjectChange: (projectId: string) => void;
  onServiceChange: (serviceId: string) => void;
  onServiceTeamChange: (serviceTeamId: string) => void;
  onRecentSelect: (recent: RecentMoveLocation) => void;
  onOk: () => void;
  onCancel: () => void;
}

const getTypeInfo = (type: ItemType): { text: string; color: string } => {
  switch (type) {
    case ItemType.PROJECT:
      return { text: '프로젝트', color: '#722ed1' };
    case ItemType.SERVICE:
      return { text: '서비스', color: '#1890ff' };
    case ItemType.TEAM:
      return { text: '팀', color: '#52c41a' };
    case ItemType.ACTION:
      return { text: '액션', color: '#fa8c16' };
    default:
      return { text: type, color: '#d9d9d9' };
  }
};

export const ItemMoveModal: React.FC<ItemMoveModalProps> = ({
  open,
  item,
  moveMode,
  searchText,
  showMyTeamOnly,
  moveTargetProjects,
  moveTargetServices,
  moveServiceTeams,
  moveSelectedProjectId,
  moveSelectedServiceId,
  selectedServiceTeamId,
  recentMoves,
  userTeamId,
  onModeChange,
  onSearchChange,
  onShowMyTeamOnlyChange,
  onProjectChange,
  onServiceChange,
  onServiceTeamChange,
  onRecentSelect,
  onOk,
  onCancel,
}) => {
  if (!item) return null;

  // 현재 위치 계산 (3단계 구조: parentId → 서비스 → 프로젝트)
  const currentLocation = useMemo(() => {
    if (item.type === ItemType.ACTION) {
      const itemAny = item as any;
      const service = itemAny.Item; // parentId가 가리키는 서비스
      const project = service?.Item; // 서비스의 부모(프로젝트)
      const creatorTeam = itemAny.User_Item_createdByIdToUser?.Team;
      return `${project?.name || '프로젝트'} > ${service?.name || '서비스'} > ${creatorTeam?.name || '팀'}`;
    }
    return '';
  }, [item]);

  // 미리보기 계산
  const previewLocation = useMemo(() => {
    if (item.type !== ItemType.ACTION) return '';

    if (!selectedServiceTeamId) return '';

    const selectedST = moveServiceTeams.find(st => st.id === selectedServiceTeamId);
    if (!selectedST) return '';

    return `${selectedST.projectName} > ${selectedST.serviceName} > ${selectedST.Team?.name}`;
  }, [item.type, selectedServiceTeamId, moveServiceTeams]);

  // 내 팀만 보기 필터링
  const filteredServiceTeams = useMemo(() => {
    let filtered = [...moveServiceTeams];

    // 내 팀만 보기
    if (showMyTeamOnly && userTeamId) {
      filtered = filtered.filter(st => st.teamId === userTeamId);
    }

    // 프로젝트 필터
    if (moveSelectedProjectId) {
      filtered = filtered.filter(st => st.projectId === moveSelectedProjectId);
    }

    // 서비스 필터
    if (moveSelectedServiceId) {
      filtered = filtered.filter(st => st.serviceId === moveSelectedServiceId);
    }

    return filtered;
  }, [moveServiceTeams, showMyTeamOnly, userTeamId, moveSelectedProjectId, moveSelectedServiceId]);

  // 검색 결과
  const searchResults = useMemo(() => {
    if (!searchText.trim()) return [];

    const lowerSearch = searchText.toLowerCase();
    return moveServiceTeams.filter(st => {
      const projectName = st.projectName?.toLowerCase() || '';
      const serviceName = st.serviceName?.toLowerCase() || '';
      const teamName = st.Team?.name?.toLowerCase() || '';

      return projectName.includes(lowerSearch) ||
             serviceName.includes(lowerSearch) ||
             teamName.includes(lowerSearch);
    });
  }, [searchText, moveServiceTeams]);

  // ACTION 전용 UI
  if (item.type === ItemType.ACTION) {
    return (
      <Modal
        title={`${getTypeInfo(item.type).text} 이동`}
        open={open}
        onOk={onOk}
        onCancel={onCancel}
        okText="이동"
        cancelText="취소"
        width={700}
        okButtonProps={{ disabled: !selectedServiceTeamId }}
      >
        {/* 현재 위치 */}
        <Alert
          message={
            <Space>
              <Text strong>현재 위치:</Text>
              <Text>{currentLocation}</Text>
            </Space>
          }
          type="info"
          showIcon
          style={{ marginBottom: 16 }}
        />

        {/* Tabs */}
        <Tabs
          activeKey={moveMode}
          onChange={(key) => onModeChange(key as 'quick' | 'search')}
          items={[
            {
              key: 'quick',
              label: (
                <Space>
                  <ThunderboltOutlined />
                  빠른 선택
                </Space>
              ),
              children: (
                <div>
                  {/* 최근 사용 */}
                  {recentMoves.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <Space direction="vertical" style={{ width: '100%' }}>
                        <Space>
                          <ClockCircleOutlined />
                          <Text strong>최근 사용</Text>
                        </Space>
                        {recentMoves.map((recent) => (
                          <div
                            key={recent.serviceTeamId}
                            onClick={() => onRecentSelect(recent)}
                            style={{
                              padding: '8px 12px',
                              background: selectedServiceTeamId === recent.serviceTeamId ? '#e6f7ff' : '#fafafa',
                              border: selectedServiceTeamId === recent.serviceTeamId ? '1px solid #1890ff' : '1px solid #d9d9d9',
                              borderRadius: 4,
                              cursor: 'pointer',
                              transition: 'all 0.3s',
                            }}
                          >
                            <Space split={<RightOutlined style={{ fontSize: 12, color: '#999' }} />}>
                              <Text>{recent.projectName}</Text>
                              <Text>{recent.serviceName}</Text>
                              <Text>{recent.teamName}</Text>
                            </Space>
                          </div>
                        ))}
                      </Space>
                    </div>
                  )}

                  {/* 필터 */}
                  <Space style={{ marginBottom: 16 }}>
                    <Checkbox
                      checked={showMyTeamOnly}
                      onChange={(e) => onShowMyTeamOnlyChange(e.target.checked)}
                    >
                      내 팀만 보기
                    </Checkbox>
                  </Space>

                  {/* 3단계 선택 */}
                  <Form layout="vertical">
                    <Form.Item label="1️⃣ 프로젝트 선택" required>
                      <Select
                        placeholder="프로젝트 선택"
                        value={moveSelectedProjectId}
                        onChange={onProjectChange}
                        options={moveTargetProjects.map((p) => ({
                          label: p.name,
                          value: p.id,
                        }))}
                        showSearch
                        filterOption={(input, option) =>
                          (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </Form.Item>

                    <Form.Item label="2️⃣ 서비스 선택" required>
                      <Select
                        placeholder="서비스 선택"
                        value={moveSelectedServiceId}
                        onChange={onServiceChange}
                        disabled={!moveSelectedProjectId}
                        options={moveTargetServices
                          .filter((s) => s.parentId === moveSelectedProjectId)
                          .map((s) => ({
                            label: s.name,
                            value: s.id,
                          }))}
                        showSearch
                        filterOption={(input, option) =>
                          (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                        }
                      />
                    </Form.Item>

                    <Form.Item label="3️⃣ 팀 선택" required>
                      <Select
                        placeholder="팀 선택"
                        value={selectedServiceTeamId}
                        onChange={onServiceTeamChange}
                        disabled={!moveSelectedServiceId}
                        options={filteredServiceTeams.map((st) => ({
                          label: (
                            <Space>
                              <Text>{st.Team?.name}</Text>
                              {st.teamId === userTeamId && <Tag color="blue">내 팀</Tag>}
                            </Space>
                          ),
                          value: st.id,
                        }))}
                        showSearch
                        filterOption={(input, option) =>
                          (option?.label ?? '').toString().toLowerCase().includes(input.toLowerCase())
                        }
                      />
                      {filteredServiceTeams.length === 0 && moveSelectedServiceId && (
                        <Alert
                          message="선택한 서비스에 팀이 없습니다"
                          type="warning"
                          showIcon
                          style={{ marginTop: 8 }}
                        />
                      )}
                    </Form.Item>
                  </Form>
                </div>
              ),
            },
            {
              key: 'search',
              label: (
                <Space>
                  <SearchOutlined />
                  검색
                </Space>
              ),
              children: (
                <div>
                  <Input
                    prefix={<SearchOutlined />}
                    placeholder="프로젝트/서비스/팀 검색..."
                    value={searchText}
                    onChange={(e) => onSearchChange(e.target.value)}
                    autoFocus
                    style={{ marginBottom: 16 }}
                  />

                  {searchText && (
                    <div>
                      <Text type="secondary">검색 결과 ({searchResults.length}개)</Text>
                      <div style={{ marginTop: 8, maxHeight: 400, overflowY: 'auto' }}>
                        {searchResults.length === 0 ? (
                          <Empty description="검색 결과가 없습니다" />
                        ) : (
                          searchResults.map((st) => (
                            <div
                              key={st.id}
                              onClick={() => onServiceTeamChange(st.id)}
                              style={{
                                padding: '12px',
                                background: selectedServiceTeamId === st.id ? '#e6f7ff' : '#fff',
                                border: selectedServiceTeamId === st.id ? '1px solid #1890ff' : '1px solid #f0f0f0',
                                borderRadius: 4,
                                cursor: 'pointer',
                                marginBottom: 8,
                                transition: 'all 0.3s',
                              }}
                            >
                              <Space direction="vertical" size={4}>
                                <Space split={<RightOutlined style={{ fontSize: 12, color: '#999' }} />}>
                                  <Tag color="purple">{st.projectName}</Tag>
                                  <Tag color="blue">{st.serviceName}</Tag>
                                  <Tag color="green">{st.Team?.name}</Tag>
                                </Space>
                                {st.teamId === userTeamId && (
                                  <Tag color="blue" style={{ marginLeft: 0 }}>내 팀</Tag>
                                )}
                              </Space>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ),
            },
          ]}
        />

        {/* 미리보기 */}
        {previewLocation && (
          <Alert
            message={
              <Space>
                <Text strong>이동 후 위치:</Text>
                <Text>{previewLocation} <RightOutlined /> {item.name}</Text>
              </Space>
            }
            type="success"
            showIcon
            style={{ marginTop: 16 }}
          />
        )}
      </Modal>
    );
  }

  // SERVICE, TEAM 타입은 기존 UI 유지 (간단한 Select)
  return (
    <Modal
      title={`${getTypeInfo(item.type).text} 이동`}
      open={open}
      onOk={onOk}
      onCancel={onCancel}
      okText="이동"
      cancelText="취소"
    >
      <Form layout="vertical">
        {item.type === ItemType.SERVICE && (
          <Form.Item label="이동할 프로젝트 선택" required>
            <Select
              placeholder="프로젝트 선택"
              value={moveSelectedProjectId}
              onChange={onProjectChange}
              options={moveTargetProjects.map((p) => ({
                label: p.name,
                value: p.id,
              }))}
            />
          </Form.Item>
        )}

        {item.type === ItemType.TEAM && (
          <Form.Item label="이동할 서비스 선택" required>
            <Select
              placeholder="서비스 선택"
              value={moveSelectedServiceId}
              onChange={onServiceChange}
              options={moveTargetServices.map((s) => ({
                label: s.name,
                value: s.id,
              }))}
            />
          </Form.Item>
        )}
      </Form>
    </Modal>
  );
};
