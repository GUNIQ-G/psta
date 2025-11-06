import React, { useState } from 'react';
import { Card, Button, Result, Input, message, Space } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, SafetyOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';
import axiosInstance from '../api/axios';

const { TextArea } = Input;

export const ApprovalRequest: React.FC = () => {
  const navigate = useNavigate();
  const { user, logout, fetchUser } = useAuthStore();
  const [loading, setLoading] = useState(false);
  const [refreshLoading, setRefreshLoading] = useState(false);
  const [approvalMessage, setApprovalMessage] = useState('');

  const handleRequestApproval = async () => {
    setLoading(true);
    try {
      await axiosInstance.post('/auth/request-approval', {
        message: approvalMessage,
      });
      message.success('승인 요청이 전송되었습니다');
      // Fetch updated user info
      await fetchUser();
    } catch (error: any) {
      message.error('승인 요청 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshStatus = async () => {
    setRefreshLoading(true);
    try {
      await fetchUser();
      // Check if user is now verified
      const updatedUser = useAuthStore.getState().user;
      if (updatedUser?.isVerified) {
        message.success('승인이 완료되었습니다! 메인 페이지로 이동합니다.');
        setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
      } else {
        message.info('아직 승인 대기 중입니다.');
      }
    } catch (error: any) {
      message.error('상태 업데이트 실패: ' + (error.response?.data?.error || error.message));
    } finally {
      setRefreshLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (!user) {
    navigate('/login');
    return null;
  }

  // 승인이 완료된 경우 대시보드로 리다이렉트
  if (user.isVerified) {
    navigate('/dashboard');
    return null;
  }

  // 이미 승인 요청을 보낸 경우
  if (user.approvalRequested) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '100vh',
          background: '#f0f2f5',
          padding: '20px',
        }}
      >
        <Card style={{ maxWidth: 600, width: '100%' }}>
          <Result
            icon={<ClockCircleOutlined style={{ color: '#faad14' }} />}
            title="승인 대기 중"
            subTitle={
              <div style={{ textAlign: 'left', marginTop: 20 }}>
                <p><strong>{user.displayName}</strong>님, 환영합니다!</p>
                <p>귀하의 계정 승인 요청이 관리자에게 전달되었습니다.</p>
                <p>관리자의 승인이 완료되면 모든 기능을 사용하실 수 있습니다.</p>
                {user.approvalRequestedAt && (
                  <p style={{ marginTop: 16, color: '#8c8c8c' }}>
                    요청 일시: {new Date(user.approvalRequestedAt).toLocaleString('ko-KR')}
                  </p>
                )}
                {user.approvalMessage && (
                  <div style={{ marginTop: 16, padding: 12, background: '#f5f5f5', borderRadius: 4 }}>
                    <div style={{ marginBottom: 8, fontWeight: 500 }}>요청 메시지:</div>
                    <div style={{ whiteSpace: 'pre-wrap' }}>{user.approvalMessage}</div>
                  </div>
                )}
              </div>
            }
            extra={
              <Space>
                <Button onClick={handleLogout}>로그아웃</Button>
                <Button type="primary" onClick={handleRefreshStatus} loading={refreshLoading}>
                  상태 새로고침
                </Button>
              </Space>
            }
          />
        </Card>
      </div>
    );
  }

  // 승인 요청을 아직 보내지 않은 경우
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: '#f0f2f5',
        padding: '20px',
      }}
    >
      <Card style={{ maxWidth: 600, width: '100%' }}>
        <Result
          icon={<SafetyOutlined style={{ color: '#1890ff' }} />}
          title="계정 승인이 필요합니다"
          subTitle={
            <div style={{ textAlign: 'left', marginTop: 20 }}>
              <p><strong>{user.displayName}</strong>님, 환영합니다!</p>
              <p>PSTA 시스템을 사용하시려면 관리자의 승인이 필요합니다.</p>
              <p>아래 버튼을 클릭하여 승인을 요청해주세요.</p>
              <p style={{ marginTop: 16, color: '#8c8c8c' }}>
                승인 요청 시 관리자에게 알림이 전송되며, 승인 완료 후 모든 기능을 사용하실 수 있습니다.
              </p>
            </div>
          }
        />

        <div style={{ marginTop: 24 }}>
          <div style={{ marginBottom: 16 }}>
            <strong>승인 요청 메시지 (선택사항)</strong>
            <p style={{ color: '#8c8c8c', fontSize: 12, marginTop: 4 }}>
              관리자에게 전달할 메시지를 입력하세요 (소속 부서, 사용 목적 등)
            </p>
          </div>
          <TextArea
            rows={4}
            placeholder="예: 저는 개발팀 소속이며, 프로젝트 일정 관리를 위해 PSTA 시스템 사용 권한이 필요합니다."
            value={approvalMessage}
            onChange={(e) => setApprovalMessage(e.target.value)}
            maxLength={500}
            showCount
          />
        </div>

        <div style={{ marginTop: 24, display: 'flex', justifyContent: 'center', gap: 12 }}>
          <Button onClick={handleLogout}>로그아웃</Button>
          <Button
            type="primary"
            size="large"
            icon={<CheckCircleOutlined />}
            onClick={handleRequestApproval}
            loading={loading}
          >
            승인 요청하기
          </Button>
        </div>

        <div style={{ marginTop: 24, padding: 16, background: '#e6f7ff', borderRadius: 4, border: '1px solid #91d5ff' }}>
          <strong style={{ color: '#0050b3' }}>안내사항</strong>
          <ul style={{ margin: '8px 0 0 0', paddingLeft: 20, color: '#0050b3' }}>
            <li>승인 요청은 즉시 관리자에게 전달됩니다</li>
            <li>승인은 영업일 기준 1~2일 소요됩니다</li>
            <li>승인 완료 시 등록하신 이메일로 알림이 발송됩니다</li>
            <li>문의사항은 시스템 관리자에게 연락해주세요</li>
          </ul>
        </div>
      </Card>
    </div>
  );
};
