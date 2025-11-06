import React, { useEffect, useState } from 'react';
import { Form, Input, Button, Card, message, Tabs, Space } from 'antd';
import { api } from '../api/axios';

const { TabPane } = Tabs;

interface LdapSettings {
  url: string;
  bindDn: string;
  bindPassword?: string;
  searchBase: string;
  searchFilter: string;
  isConfigured: boolean;
}

interface SlackSettings {
  botToken?: string;
  defaultChannel: string;
  isConfigured: boolean;
}

export const Settings: React.FC = () => {
  const [ldapForm] = Form.useForm();
  const [slackForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [ldapConfigured, setLdapConfigured] = useState(false);
  const [slackConfigured, setSlackConfigured] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      // Load LDAP settings
      const ldapRes = await api.get<LdapSettings>('/api/settings/ldap');
      ldapForm.setFieldsValue({
        url: ldapRes.data.url,
        bindDn: ldapRes.data.bindDn,
        searchBase: ldapRes.data.searchBase,
        searchFilter: ldapRes.data.searchFilter,
      });
      setLdapConfigured(ldapRes.data.isConfigured);

      // Load Slack settings
      const slackRes = await api.get<SlackSettings>('/api/settings/slack');
      slackForm.setFieldsValue({
        defaultChannel: slackRes.data.defaultChannel,
      });
      setSlackConfigured(slackRes.data.isConfigured);
    } catch (error: any) {
      message.error('Failed to load settings');
    }
  };

  const handleLdapTest = async () => {
    try {
      const values = await ldapForm.validateFields();
      setTesting(true);

      const res = await api.post('/api/settings/ldap/test', values);

      if (res.data.success) {
        message.success('LDAP connection successful!');
      } else {
        message.error(res.data.message || 'Connection failed');
      }
    } catch (error: any) {
      message.error(error.response?.data?.message || 'Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const handleLdapSubmit = async (values: any) => {
    try {
      setLoading(true);
      await api.put('/api/settings/ldap', values);
      message.success('LDAP settings saved successfully');
      setLdapConfigured(true);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to save LDAP settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSlackSubmit = async (values: any) => {
    try {
      setLoading(true);
      await api.put('/api/settings/slack', values);
      message.success('Slack settings saved successfully');
      setSlackConfigured(true);
    } catch (error: any) {
      message.error(error.response?.data?.error || 'Failed to save Slack settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '24px' }}>
      <h1>System Settings</h1>

      <Tabs defaultActiveKey="ldap">
        <TabPane tab="LDAP Configuration" key="ldap">
          <Card>
            <Form
              form={ldapForm}
              layout="vertical"
              onFinish={handleLdapSubmit}
            >
              <Form.Item
                label="LDAP Server URL"
                name="url"
                rules={[{ required: true, message: 'Please enter LDAP server URL' }]}
                tooltip="Example: ldap://ldap.example.com:389"
              >
                <Input placeholder="ldap://ldap.example.com:389" />
              </Form.Item>

              <Form.Item
                label="Bind DN"
                name="bindDn"
                rules={[{ required: true, message: 'Please enter Bind DN' }]}
                tooltip="Example: cn=admin,dc=example,dc=com"
              >
                <Input placeholder="cn=admin,dc=example,dc=com" />
              </Form.Item>

              <Form.Item
                label="Bind Password"
                name="bindPassword"
                rules={[
                  { required: !ldapConfigured, message: 'Please enter Bind Password' }
                ]}
                tooltip="Leave empty to keep existing password"
              >
                <Input.Password placeholder={ldapConfigured ? "Leave empty to keep existing" : "Enter password"} />
              </Form.Item>

              <Form.Item
                label="Search Base"
                name="searchBase"
                rules={[{ required: true, message: 'Please enter Search Base' }]}
                tooltip="Example: ou=users,dc=example,dc=com"
              >
                <Input placeholder="ou=users,dc=example,dc=com" />
              </Form.Item>

              <Form.Item
                label="Search Filter"
                name="searchFilter"
                tooltip="Use {{username}} as placeholder. Default: (uid={{username}})"
              >
                <Input placeholder="(uid={{username}})" />
              </Form.Item>

              <Form.Item>
                <Space>
                  <Button type="primary" htmlType="submit" loading={loading}>
                    Save Settings
                  </Button>
                  <Button onClick={handleLdapTest} loading={testing}>
                    Test Connection
                  </Button>
                </Space>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>

        <TabPane tab="Slack Configuration" key="slack">
          <Card>
            <Form
              form={slackForm}
              layout="vertical"
              onFinish={handleSlackSubmit}
            >
              <Form.Item
                label="Slack Bot Token"
                name="botToken"
                rules={[
                  { required: !slackConfigured, message: 'Please enter Slack Bot Token' }
                ]}
                tooltip="Leave empty to keep existing token. Get token from https://api.slack.com/apps"
              >
                <Input.Password placeholder={slackConfigured ? "Leave empty to keep existing" : "xoxb-..."} />
              </Form.Item>

              <Form.Item
                label="Default Channel"
                name="defaultChannel"
                rules={[{ required: true, message: 'Please enter default channel' }]}
                tooltip="Example: #notifications"
              >
                <Input placeholder="#notifications" />
              </Form.Item>

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={loading}>
                  Save Settings
                </Button>
              </Form.Item>
            </Form>
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};
