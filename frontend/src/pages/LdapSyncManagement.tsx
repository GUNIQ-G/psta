import React, { useEffect, useState } from 'react';
import {
  Card,
  Button,
  Space,
  Statistic,
  Row,
  Col,
  Alert,
  Tag,
  Spin,
  Modal,
  Typography,
  Divider,
  Table,
  message,
} from 'antd';
import {
  SyncOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ClockCircleOutlined,
  TeamOutlined,
  UserOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { ldapSyncApi, SyncResult, SyncStats } from '../api/ldap-sync';
import dayjs from 'dayjs';
import relativeTime from 'dayjs/plugin/relativeTime';
import 'dayjs/locale/ko';

dayjs.extend(relativeTime);
dayjs.locale('ko');

const { Title, Text, Paragraph } = Typography;
const { confirm } = Modal;

const LdapSyncManagement: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState<SyncStats | null>(null);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, resultRes] = await Promise.all([
        ldapSyncApi.getSyncStats(),
        ldapSyncApi.getLastSyncResult(),
      ]);

      if (statsRes.success) {
        setStats(statsRes.stats);
      }

      if (resultRes.success && resultRes.result) {
        setLastResult(resultRes.result);
      }
    } catch (error: any) {
      message.error('데이터 로드 실패: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSync = (dryRun: boolean = false) => {
    const action = dryRun ? '미리보기' : '동기화';

    confirm({
      title: `LDAP ${action}를 실행하시겠습니까?`,
      icon: <ExclamationCircleOutlined />,
      content: dryRun
        ? 'Dry-run 모드로 실행하여 변경 사항을 미리 확인합니다. 실제 데이터는 변경되지 않습니다.'
        : 'LDAP의 팀과 사용자 정보를 PSTA에 동기화합니다. LDAP에 없는 팀과 사용자는 비활성화됩니다.',
      okText: '실행',
      cancelText: '취소',
      onOk: async () => {
        try {
          setSyncing(true);
          const response = await ldapSyncApi.triggerSync(dryRun);

          if (response.success) {
            message.success(`${action} 완료`);
            setLastResult(response.result);

            // Reload stats
            const statsRes = await ldapSyncApi.getSyncStats();
            if (statsRes.success) {
              setStats(statsRes.stats);
            }

            // Show result modal
            showResultModal(response.result, dryRun);
          } else {
            message.error(`${action} 실패`);
          }
        } catch (error: any) {
          message.error(`${action} 실패: ` + error.message);
        } finally {
          setSyncing(false);
        }
      },
    });
  };

  const showResultModal = (result: SyncResult, dryRun: boolean) => {
    Modal.info({
      title: dryRun ? '동기화 미리보기 결과' : '동기화 결과',
      width: 700,
      content: (
        <div style={{ marginTop: 16 }}>
          <Row gutter={16}>
            <Col span={12}>
              <Statistic
                title="생성된 팀"
                value={result.teamsCreated}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#3f8600' }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="비활성화된 팀"
                value={result.teamsDeactivated}
                prefix={<TeamOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Col>
          </Row>
          <Row gutter={16} style={{ marginTop: 16 }}>
            <Col span={12}>
              <Statistic
                title="비활성화된 사용자"
                value={result.usersDeactivated}
                prefix={<UserOutlined />}
                valueStyle={{ color: '#cf1322' }}
              />
            </Col>
            <Col span={12}>
              <Statistic
                title="팀 멤버십 업데이트"
                value={result.teamMembershipsUpdated}
                prefix={<SyncOutlined />}
                valueStyle={{ color: '#1890ff' }}
              />
            </Col>
          </Row>

          {result.details.teamsCreated.length > 0 && (
            <>
              <Divider />
              <Text strong>생성된 팀:</Text>
              <ul>
                {result.details.teamsCreated.map((name, idx) => (
                  <li key={idx}>{name}</li>
                ))}
              </ul>
            </>
          )}

          {result.details.teamsDeactivated.length > 0 && (
            <>
              <Divider />
              <Text strong>비활성화된 팀:</Text>
              <ul>
                {result.details.teamsDeactivated.map((name, idx) => (
                  <li key={idx}>{name}</li>
                ))}
              </ul>
            </>
          )}

          {result.details.usersDeactivated.length > 0 && (
            <>
              <Divider />
              <Text strong>비활성화된 사용자:</Text>
              <ul>
                {result.details.usersDeactivated.map((name, idx) => (
                  <li key={idx}>{name}</li>
                ))}
              </ul>
            </>
          )}

          {result.errors.length > 0 && (
            <>
              <Divider />
              <Alert
                type="error"
                message="오류 발생"
                description={
                  <ul>
                    {result.errors.map((error, idx) => (
                      <li key={idx}>{error}</li>
                    ))}
                  </ul>
                }
              />
            </>
          )}
        </div>
      ),
    });
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 50 }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ padding: 24 }}>
      <Title level={2}>LDAP 동기화 관리</Title>
      <Paragraph>
        LDAP 서버의 팀(그룹)과 사용자 정보를 PSTA와 동기화합니다.
        <br />
        동기화는 매일 새벽 2시에 자동으로 실행되며, 수동으로도 실행할 수 있습니다.
      </Paragraph>

      {/* Action Buttons */}
      <Card style={{ marginBottom: 24 }}>
        <Space size="middle">
          <Button
            type="primary"
            size="large"
            icon={<SyncOutlined />}
            loading={syncing}
            onClick={() => handleSync(false)}
          >
            동기화 실행
          </Button>
          <Button
            size="large"
            icon={<SyncOutlined />}
            loading={syncing}
            onClick={() => handleSync(true)}
          >
            미리보기 (Dry-run)
          </Button>
          <Button size="large" onClick={loadData}>
            새로고침
          </Button>
        </Space>
      </Card>

      {/* Statistics */}
      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={8}>
          <Card>
            <Statistic
              title="LDAP 그룹"
              value={stats?.ldapGroups || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="LDAP 사용자"
              value={stats?.ldapUsers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={8}>
          <Card>
            <Statistic
              title="PSTA 팀"
              value={stats?.pstaTeams || 0}
              prefix={<TeamOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: 24 }}>
        <Col span={12}>
          <Card>
            <Statistic
              title="활성 사용자"
              value={stats?.pstaActiveUsers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={12}>
          <Card>
            <Statistic
              title="비활성 사용자"
              value={stats?.pstaInactiveUsers || 0}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#8c8c8c' }}
            />
          </Card>
        </Col>
      </Row>

      {/* Last Sync Status */}
      <Card title="마지막 동기화 상태" style={{ marginBottom: 24 }}>
        {stats?.lastSync ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Space>
              {stats.lastSyncSuccess ? (
                <Tag icon={<CheckCircleOutlined />} color="success">
                  성공
                </Tag>
              ) : (
                <Tag icon={<CloseCircleOutlined />} color="error">
                  실패
                </Tag>
              )}
              <Text>
                <ClockCircleOutlined /> {dayjs(stats.lastSync).format('YYYY-MM-DD HH:mm:ss')} (
                {dayjs(stats.lastSync).fromNow()})
              </Text>
            </Space>

            {lastResult && (
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={6}>
                  <Statistic
                    title="생성된 팀"
                    value={lastResult.teamsCreated}
                    valueStyle={{ fontSize: 18 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="비활성화된 팀"
                    value={lastResult.teamsDeactivated}
                    valueStyle={{ fontSize: 18 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="비활성화된 사용자"
                    value={lastResult.usersDeactivated}
                    valueStyle={{ fontSize: 18 }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="멤버십 업데이트"
                    value={lastResult.teamMembershipsUpdated}
                    valueStyle={{ fontSize: 18 }}
                  />
                </Col>
              </Row>
            )}
          </Space>
        ) : (
          <Alert
            message="동기화 이력 없음"
            description="아직 동기화가 실행된 적이 없습니다."
            type="info"
            showIcon
          />
        )}
      </Card>

      {/* Sync Schedule Info */}
      <Card title="자동 동기화 일정">
        <Space direction="vertical" style={{ width: '100%' }}>
          <Alert
            message="자동 동기화 활성화"
            description="매일 새벽 2시 (KST)에 자동으로 LDAP 동기화가 실행됩니다."
            type="success"
            showIcon
            icon={<ClockCircleOutlined />}
          />

          <Divider />

          <Title level={5}>동기화 규칙</Title>
          <ul>
            <li>
              <Text strong>팀 생성:</Text> LDAP에 있지만 PSTA에 없는 그룹은 자동으로 팀으로 생성됩니다.
            </li>
            <li>
              <Text strong>팀 비활성화:</Text> LDAP에 없지만 PSTA에 있는 팀은 비활성화됩니다. (삭제되지
              않음)
            </li>
            <li>
              <Text strong>사용자 비활성화:</Text> LDAP에 없는 PSTA 사용자는 비활성화됩니다.
            </li>
            <li>
              <Text strong>팀 멤버십:</Text> LDAP 그룹 멤버십에 따라 사용자의 팀이 자동으로 업데이트됩니다.
            </li>
            <li>
              <Text strong>데이터 보존:</Text> 모든 작업 이력, 댓글, 파일 등은 보존됩니다.
            </li>
          </ul>
        </Space>
      </Card>
    </div>
  );
};

export default LdapSyncManagement;
