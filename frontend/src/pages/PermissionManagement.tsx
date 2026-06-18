import React, { useState, useEffect } from 'react';
import {
  Table,
  Select,
  Switch,
  Button,
  message,
  Typography,
  Space,
  Tag,
} from 'antd';
import { SaveOutlined, ReloadOutlined } from '@ant-design/icons';
import { Permission, UserRole } from '../types';
import { permissionApi } from '../api/permissions';
import { PERMISSION_GROUPS } from '../constants/menuConfig';

const { Title, Text } = Typography;
const { Option } = Select;

interface PermissionRow {
  key: string;
  id: string;
  resource: string;
  resourceLabel: string;
  canView: boolean;
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

const RESOURCE_GROUPS = PERMISSION_GROUPS;

const ROLE_LABELS: { [key in UserRole]: { label: string; color: string } } = {
  [UserRole.ADMIN]: { label: '최고 관리자', color: 'red' },
  [UserRole.PO]: { label: 'PO (프로젝트 책임자)', color: 'purple' },
  [UserRole.PM]: { label: 'PM (프로젝트 관리자)', color: 'blue' },
  [UserRole.MEMBER]: { label: '일반 사용자', color: 'green' },
};

const PermissionManagement: React.FC = () => {
  const [selectedRole, setSelectedRole] = useState<UserRole>(UserRole.ADMIN);
  const [permissions, setPermissions] = useState<PermissionRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    loadPermissions();
  }, [selectedRole]);

  const loadPermissions = async () => {
    setLoading(true);
    try {
      const data = await permissionApi.getPermissionsByRole(selectedRole);

      // 그룹 순서대로 정렬
      const orderedResources: string[] = [];
      RESOURCE_GROUPS.forEach(group => {
        group.resources.forEach(res => {
          orderedResources.push(res.key);
        });
      });

      // 리소스 레이블 맵 생성
      const resourceLabelMap: { [key: string]: string } = {};
      RESOURCE_GROUPS.forEach(group => {
        group.resources.forEach(res => {
          resourceLabelMap[res.key] = res.label;
        });
      });

      const rows: PermissionRow[] = data
        .map((p) => ({
          key: p.id,
          id: p.id,
          resource: p.resource,
          resourceLabel: resourceLabelMap[p.resource] || p.resource,
          canView: p.canView,
          canCreate: p.canCreate,
          canUpdate: p.canUpdate,
          canDelete: p.canDelete,
        }))
        .sort((a, b) => {
          const indexA = orderedResources.indexOf(a.resource);
          const indexB = orderedResources.indexOf(b.resource);
          return indexA - indexB;
        });

      setPermissions(rows);
      setHasChanges(false);
    } catch (error: any) {
      message.error('권한 정보를 불러오는데 실패했습니다.');
      console.error(error);
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (
    id: string,
    field: 'canView' | 'canCreate' | 'canUpdate' | 'canDelete',
    value: boolean
  ) => {
    setPermissions((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = permissions.map((p) => ({
        resource: p.resource,
        canView: p.canView,
        canCreate: p.canCreate,
        canUpdate: p.canUpdate,
        canDelete: p.canDelete,
      }));

      await permissionApi.updateRolePermissions(selectedRole, updates);
      message.success('권한이 성공적으로 저장되었습니다.');
      setHasChanges(false);
    } catch (error: any) {
      message.error('권한 저장에 실패했습니다.');
      console.error(error);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    loadPermissions();
  };

  const columns = [
    {
      title: '리소스',
      dataIndex: 'resourceLabel',
      key: 'resourceLabel',
      width: 250,
      render: (text: string) => <Text strong>{text}</Text>,
    },
    {
      title: '조회',
      dataIndex: 'canView',
      key: 'canView',
      width: 120,
      align: 'center' as const,
      render: (value: boolean, record: PermissionRow) => (
        <Switch
          checked={value}
          onChange={(checked) =>
            handlePermissionChange(record.id, 'canView', checked)
          }
        />
      ),
    },
    {
      title: '생성',
      dataIndex: 'canCreate',
      key: 'canCreate',
      width: 120,
      align: 'center' as const,
      render: (value: boolean, record: PermissionRow) => (
        <Switch
          checked={value}
          onChange={(checked) =>
            handlePermissionChange(record.id, 'canCreate', checked)
          }
        />
      ),
    },
    {
      title: '수정',
      dataIndex: 'canUpdate',
      key: 'canUpdate',
      width: 120,
      align: 'center' as const,
      render: (value: boolean, record: PermissionRow) => (
        <Switch
          checked={value}
          onChange={(checked) =>
            handlePermissionChange(record.id, 'canUpdate', checked)
          }
        />
      ),
    },
    {
      title: '삭제',
      dataIndex: 'canDelete',
      key: 'canDelete',
      width: 120,
      align: 'center' as const,
      render: (value: boolean, record: PermissionRow) => (
        <Switch
          checked={value}
          onChange={(checked) =>
            handlePermissionChange(record.id, 'canDelete', checked)
          }
        />
      ),
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
        <Space>
          <Button
            icon={<ReloadOutlined />}
            onClick={handleReset}
            disabled={!hasChanges}
          >
            초기화
          </Button>
          <Button
            type="primary"
            icon={<SaveOutlined />}
            onClick={handleSave}
            loading={saving}
            disabled={!hasChanges}
          >
            저장
          </Button>
        </Space>
      </div>

      <div style={{ marginBottom: 16 }}>
        <Space>
          <Text strong>역할 선택:</Text>
          <Select
            style={{ width: 250 }}
            value={selectedRole}
            onChange={(value) => setSelectedRole(value)}
            size="large"
          >
            {Object.entries(ROLE_LABELS).map(([role, config]) => (
              <Option key={role} value={role}>
                <Tag color={config.color}>{config.label}</Tag>
              </Option>
            ))}
          </Select>
        </Space>
      </div>

      {RESOURCE_GROUPS.map((group, groupIndex) => {
        const groupResources = group.resources.map(r => r.key);
        const groupPermissions = permissions.filter(p => groupResources.includes(p.resource));

        return (
          <div key={group.title} style={{ marginBottom: 40 }}>
            <div style={{ marginBottom: 16, paddingBottom: 8, borderBottom: '1px solid #f0f0f0' }}>
              <Text strong style={{ fontSize: 11, color: 'rgba(0, 0, 0, 0.45)', textTransform: 'uppercase', letterSpacing: '1px' }}>
                {group.title}
              </Text>
            </div>
            <Table
              columns={columns}
              dataSource={groupPermissions}
              loading={loading && groupIndex === 0}
              pagination={false}
              size="middle"
            />
          </div>
        );
      })}
    </div>
  );
};

export default PermissionManagement;
