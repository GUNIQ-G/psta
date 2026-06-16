import React, { useState, useEffect, useMemo } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  message,
  Popconfirm,
  Tag,
  Modal,
  Spin,
  Empty,
  Typography,
  Tree,
  Input,
  Badge,
  Tooltip,
} from 'antd';
import type { TreeDataNode } from 'antd';
import {
  SafetyOutlined,
  PlusOutlined,
  SyncOutlined,
  DeleteOutlined,
  SearchOutlined,
  UserOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  ApartmentOutlined,
  MailOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import axiosInstance from '../api/axios';
import type { ColumnsType } from 'antd/es/table';
import { ldapSyncApi, LdapTreeNode } from '../api/ldap-sync';

interface LdapConfig {
  id: string;
  name: string;
  host: string;
  port: number;
  protocol: string;
  userCount: number;
  isActive: boolean;
  lastTestedAt?: string;
  lastTestSuccess?: boolean;
  createdAt: string;
  updatedAt: string;
}

export const LDAPAuth: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [configs, setConfigs] = useState<LdapConfig[]>([]);
  const [testingIds, setTestingIds] = useState<Set<string>>(new Set());

  // LDAP Preview states (v1.1.19: Hierarchical tree)
  const [isPreviewModalVisible, setIsPreviewModalVisible] = useState(false);
  const [treeData, setTreeData] = useState<LdapTreeNode[]>([]);
  const [checkedKeys, setCheckedKeys] = useState<React.Key[]>([]);
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [searchValue, setSearchValue] = useState('');
  const [previewLoading, setPreviewLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [totalOrgs, setTotalOrgs] = useState(0);
  const [totalUsers, setTotalUsers] = useState(0);

  useEffect(() => {
    fetchConfigs();
  }, []);

  const fetchConfigs = async () => {
    setLoading(true);
    try {
      const response = await axiosInstance.get('/ldap/configs');
      setConfigs(response.data);
    } catch (error: any) {
      message.error('LDAP 설정 목록을 불러오는데 실패했습니다');
    } finally {
      setLoading(false);
    }
  };

  const handleTest = async (id: string, name: string) => {
    setTestingIds((prev) => new Set(prev).add(id));
    try {
      const response = await axiosInstance.post(`/ldap/configs/${id}/test`);
      if (response.data.success) {
        message.success({
          content: (
            <div>
              <strong>{name}</strong>
              <br />
              LDAP 연결 테스트 성공
            </div>
          ),
          duration: 3,
        });
      } else {
        message.error({
          content: (
            <div>
              <strong>{name}</strong>
              <br />
              LDAP 연결 테스트 실패
            </div>
          ),
          duration: 5,
        });
      }
      // v1.1.18: Refresh configs to show updated test result
      await fetchConfigs();
    } catch (error: any) {
      const errorMsg = error.response?.data?.message || error.message || '알 수 없는 오류';
      message.error({
        content: (
          <div>
            <strong>{name}</strong>
            <br />
            연결 실패: {errorMsg}
          </div>
        ),
        duration: 8,
      });
      // v1.1.18: Refresh configs to show updated test result
      await fetchConfigs();
    } finally {
      setTestingIds((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    }
  };

  const handleDelete = async (id: string, name: string) => {
    try {
      await axiosInstance.delete(`/ldap/configs/${id}`);
      message.success(`"${name}" LDAP 설정이 삭제되었습니다`);
      fetchConfigs();
    } catch (error: any) {
      message.error('삭제 실패: ' + error.message);
    }
  };

  const handleEdit = (id: string) => {
    navigate(`/ldap-settings/${id}`);
  };

  // v1.1.19: Convert LDAP tree to Ant Design Tree format
  const convertToTreeData = (nodes: LdapTreeNode[]): TreeDataNode[] => {
    return nodes.map(node => {
      const isOrg = node.type === 'organization';
      const statusColor =
        node.pstaStatus === 'active' ? '#52c41a' :
        node.pstaStatus === 'inactive' ? '#faad14' : '#8c8c8c';

      // Build title with icons and status
      const title = (
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          {isOrg ? (
            <ApartmentOutlined style={{ color: '#1890ff' }} />
          ) : (
            <UserOutlined style={{ color: '#8c8c8c' }} />
          )}
          <span>{node.title}</span>
          {node.uid && (
            <span style={{ color: '#8c8c8c', fontSize: 12 }}>
              ({node.uid})
            </span>
          )}
          {!isOrg && node.pstaStatus && (
            <Tag
              color={node.pstaStatus === 'active' ? 'success' : node.pstaStatus === 'inactive' ? 'warning' : 'default'}
              style={{ marginLeft: 4, fontSize: 11 }}
            >
              {node.pstaStatus === 'active' ? 'PSTA' : node.pstaStatus === 'inactive' ? '비활성' : '신규'}
            </Tag>
          )}
          {node.email && (
            <Tooltip title={node.email}>
              <MailOutlined style={{ color: '#8c8c8c', fontSize: 12 }} />
            </Tooltip>
          )}
          {node.pstaTeam && (
            <Tag color="blue" style={{ fontSize: 11 }}>
              {node.pstaTeam}
            </Tag>
          )}
        </span>
      );

      return {
        key: node.key,
        title,
        children: node.children ? convertToTreeData(node.children) : undefined,
        icon: isOrg ? <TeamOutlined /> : <UserOutlined />,
      };
    });
  };

  // Get all keys from tree for expand all
  const getAllKeys = (nodes: LdapTreeNode[]): string[] => {
    const keys: string[] = [];
    const traverse = (items: LdapTreeNode[]) => {
      items.forEach(item => {
        keys.push(item.key);
        if (item.children) traverse(item.children);
      });
    };
    traverse(nodes);
    return keys;
  };

  // Get only user keys for counting
  const getUserKeys = (nodes: LdapTreeNode[]): string[] => {
    const keys: string[] = [];
    const traverse = (items: LdapTreeNode[]) => {
      items.forEach(item => {
        if (item.type === 'user') keys.push(item.key);
        if (item.children) traverse(item.children);
      });
    };
    traverse(nodes);
    return keys;
  };

  // Memoized tree data with search filter
  const filteredTreeData = useMemo(() => {
    if (!searchValue) return convertToTreeData(treeData);

    const filterNodes = (nodes: LdapTreeNode[]): LdapTreeNode[] => {
      const result: LdapTreeNode[] = [];
      for (const node of nodes) {
        const titleMatch = node.title.toLowerCase().includes(searchValue.toLowerCase());
        const uidMatch = node.uid?.toLowerCase().includes(searchValue.toLowerCase());
        const emailMatch = node.email?.toLowerCase().includes(searchValue.toLowerCase());

        if (titleMatch || uidMatch || emailMatch) {
          result.push(node);
        } else if (node.children) {
          const filteredChildren = filterNodes(node.children);
          if (filteredChildren.length > 0) {
            result.push({ ...node, children: filteredChildren });
          }
        }
      }
      return result;
    };

    return convertToTreeData(filterNodes(treeData));
  }, [treeData, searchValue]);

  // Count selected users
  const selectedUserCount = useMemo(() => {
    return checkedKeys.filter(key => String(key).startsWith('user-')).length;
  }, [checkedKeys]);

  const selectedOrgCount = useMemo(() => {
    return checkedKeys.filter(key => String(key).startsWith('org-')).length;
  }, [checkedKeys]);

  const handleLdapPreview = async () => {
    setPreviewLoading(true);
    setIsPreviewModalVisible(true);
    try {
      const response = await ldapSyncApi.previewHierarchicalLdap();
      if (response.success) {
        setTreeData(response.tree);
        setTotalOrgs(response.totalOrgs);
        setTotalUsers(response.totalUsers);
        setCheckedKeys([]);
        // Expand first level by default
        const firstLevelKeys = response.tree.map(node => node.key);
        setExpandedKeys(firstLevelKeys);
      }
    } catch (error: any) {
      message.error('LDAP 미리보기 로드 실패: ' + error.message);
      setIsPreviewModalVisible(false);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleApplySelected = async () => {
    if (checkedKeys.length === 0) {
      message.warning('적용할 항목을 선택해주세요');
      return;
    }

    Modal.confirm({
      title: '선택한 항목 적용',
      content: (
        <div>
          <p>선택한 항목을 PSTA에 적용합니다.</p>
          <ul>
            <li>조직: {selectedOrgCount}개 (팀으로 생성/업데이트)</li>
            <li>사용자: {selectedUserCount}명 (생성/업데이트)</li>
          </ul>
          <p style={{ color: '#1890ff', marginTop: 16 }}>
            <strong>안내:</strong> 선택한 항목만 적용되며, 기존 데이터는 영향을 받지 않습니다.
          </p>
        </div>
      ),
      okText: '적용',
      okType: 'primary',
      cancelText: '취소',
      onOk: async () => {
        setSyncing(true);
        try {
          const response = await ldapSyncApi.applySelectedLdapItems(checkedKeys as string[], false);
          if (response.success) {
            const result = response.result;
            Modal.success({
              title: 'LDAP 적용 완료',
              content: (
                <div>
                  <p>선택한 항목이 성공적으로 적용되었습니다.</p>
                  <ul>
                    <li>팀 생성: {result.teamsCreated}개</li>
                    <li>사용자 생성/업데이트: {result.teamMembershipsUpdated}명</li>
                    {result.errors.length > 0 && (
                      <li style={{ color: '#ff4d4f' }}>오류: {result.errors.length}개</li>
                    )}
                  </ul>
                  {result.errors.length > 0 && (
                    <div style={{ marginTop: 12 }}>
                      <Typography.Text type="danger" strong>오류 내용:</Typography.Text>
                      <ul style={{ marginTop: 8 }}>
                        {result.errors.map((err, idx) => (
                          <li key={idx} style={{ color: '#ff4d4f', fontSize: 12 }}>{err}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ),
            });
            setIsPreviewModalVisible(false);
            await fetchConfigs();
          }
        } catch (error: any) {
          message.error('LDAP 적용 실패: ' + error.message);
        } finally {
          setSyncing(false);
        }
      },
    });
  };

  const columns: ColumnsType<LdapConfig> = [
    {
      title: '이름',
      dataIndex: 'name',
      key: 'name',
      render: (name: string) => <strong>{name}</strong>,
    },
    {
      title: '방식',
      dataIndex: 'protocol',
      key: 'protocol',
      render: (protocol: string) => (
        <Tag color={protocol === 'LDAPS' ? 'green' : 'blue'}>
          {protocol}
        </Tag>
      ),
    },
    {
      title: '호스트',
      key: 'host',
      render: (_, record) => `${record.host}:${record.port}`,
    },
    {
      title: '사용자',
      dataIndex: 'userCount',
      key: 'userCount',
      render: (count: number) => <span>{count}명</span>,
    },
    {
      title: '테스트 결과',
      key: 'testResult',
      render: (_, record) => {
        if (!record.lastTestedAt) {
          return (
            <Tag icon={<ClockCircleOutlined />} color="default">
              미테스트
            </Tag>
          );
        }

        const testDate = new Date(record.lastTestedAt);
        const now = new Date();
        const diffHours = (now.getTime() - testDate.getTime()) / (1000 * 60 * 60);
        const timeAgo =
          diffHours < 1 ? '방금' :
          diffHours < 24 ? `${Math.floor(diffHours)}시간 전` :
          `${Math.floor(diffHours / 24)}일 전`;

        if (record.lastTestSuccess) {
          return (
            <Tag icon={<CheckCircleOutlined />} color="success">
              성공 ({timeAgo})
            </Tag>
          );
        } else {
          return (
            <Tag icon={<CloseCircleOutlined />} color="error">
              실패 ({timeAgo})
            </Tag>
          );
        }
      },
    },
    {
      title: '상태',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive: boolean) => (
        <Tag color={isActive ? 'success' : 'default'}>
          {isActive ? '활성' : '비활성'}
        </Tag>
      ),
    },
    {
      title: '작업',
      key: 'action',
      render: (_, record) => (
        <Space>
          <Button
            size="small"
            icon={<SyncOutlined />}
            onClick={() => handleTest(record.id, record.name)}
            loading={testingIds.has(record.id)}
          >
            테스트
          </Button>
          <Button
            size="small"
            onClick={() => handleEdit(record.id)}
          >
            수정
          </Button>
          <Popconfirm
            title="LDAP 설정 삭제"
            description={`"${record.name}" 설정을 삭제하시겠습니까?`}
            onConfirm={() => handleDelete(record.id, record.name)}
            okText="삭제"
            cancelText="취소"
            okButtonProps={{ danger: true }}
          >
            <Button
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              삭제
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <Card
        title={
          <Space>
            <SafetyOutlined />
            <span>LDAP 인증</span>
          </Space>
        }
        extra={
          <Space>
            <Button
              icon={<SearchOutlined />}
              onClick={handleLdapPreview}
            >
              LDAP 미리보기
            </Button>
            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/ldap-settings/new')}
            >
              새 인증
            </Button>
          </Space>
        }
      >
        <Table
          columns={columns}
          dataSource={configs}
          rowKey="id"
          loading={loading}
          pagination={{
            pageSize: 10,
            showSizeChanger: true,
            showTotal: (total) => `전체 ${total}개`,
          }}
        />
      </Card>

      {/* LDAP Preview Modal - v1.1.19: Hierarchical Tree */}
      <Modal
        title={
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <ApartmentOutlined />
            <span>LDAP 조직/사용자 미리보기</span>
            {!previewLoading && (
              <span style={{ fontSize: 12, color: '#8c8c8c', fontWeight: 400, marginLeft: 8 }}>
                (조직: {totalOrgs}개, 사용자: {totalUsers}명)
              </span>
            )}
          </div>
        }
        open={isPreviewModalVisible}
        onCancel={() => {
          setIsPreviewModalVisible(false);
          setCheckedKeys([]);
          setSearchValue('');
        }}
        width={900}
        footer={[
          <Button key="cancel" onClick={() => setIsPreviewModalVisible(false)}>
            취소
          </Button>,
          <Button
            key="expandAll"
            onClick={() => {
              if (expandedKeys.length === getAllKeys(treeData).length) {
                setExpandedKeys([]);
              } else {
                setExpandedKeys(getAllKeys(treeData));
              }
            }}
          >
            {expandedKeys.length === getAllKeys(treeData).length ? '모두 접기' : '모두 펼치기'}
          </Button>,
          <Button
            key="selectAll"
            onClick={() => {
              const allKeys = getAllKeys(treeData);
              if (checkedKeys.length === allKeys.length) {
                setCheckedKeys([]);
              } else {
                setCheckedKeys(allKeys);
              }
            }}
          >
            {checkedKeys.length === getAllKeys(treeData).length ? '전체 해제' : '전체 선택'}
          </Button>,
          <Button
            key="apply"
            type="primary"
            icon={<CheckCircleOutlined />}
            onClick={handleApplySelected}
            disabled={checkedKeys.length === 0}
            loading={syncing}
          >
            적용 ({selectedOrgCount}개 조직, {selectedUserCount}명)
          </Button>,
        ]}
      >
        {/* Search and Stats */}
        <div style={{ marginBottom: 16 }}>
          <Space direction="vertical" style={{ width: '100%' }}>
            <Typography.Text type="secondary">
              LDAP 서버의 조직 구조와 사용자 목록입니다. 적용할 항목을 선택하세요.
            </Typography.Text>
            <Input.Search
              placeholder="이름, ID, 이메일로 검색..."
              allowClear
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              style={{ maxWidth: 400 }}
            />
            {checkedKeys.length > 0 && (
              <div style={{ display: 'flex', gap: 8 }}>
                <Badge count={selectedOrgCount} style={{ backgroundColor: '#1890ff' }}>
                  <Tag icon={<ApartmentOutlined />}>조직</Tag>
                </Badge>
                <Badge count={selectedUserCount} style={{ backgroundColor: '#52c41a' }}>
                  <Tag icon={<UserOutlined />}>사용자</Tag>
                </Badge>
              </div>
            )}
          </Space>
        </div>

        <Spin spinning={previewLoading}>
          <div style={{
            maxHeight: 500,
            overflowY: 'auto',
            border: '1px solid #d9d9d9',
            borderRadius: 6,
            padding: 8,
            backgroundColor: '#fafafa',
          }}>
            {treeData.length === 0 && !previewLoading ? (
              <Empty description="LDAP 데이터가 없습니다" />
            ) : (
              <Tree
                checkable
                showLine={{ showLeafIcon: false }}
                expandedKeys={expandedKeys}
                onExpand={(keys) => setExpandedKeys(keys as React.Key[])}
                checkedKeys={checkedKeys}
                onCheck={(checked) => {
                  if (Array.isArray(checked)) {
                    setCheckedKeys(checked);
                  } else {
                    setCheckedKeys(checked.checked);
                  }
                }}
                treeData={filteredTreeData}
                height={450}
                virtual
              />
            )}
          </div>
        </Spin>
      </Modal>
    </div>
  );
};
