import { WebClient } from '@slack/web-api';

export const slackClient = new WebClient(process.env.SLACK_BOT_TOKEN);

export const slackConfig = {
  defaultChannel: process.env.SLACK_DEFAULT_CHANNEL || '#psta-notifications',
  botToken: process.env.SLACK_BOT_TOKEN,
  signingSecret: process.env.SLACK_SIGNING_SECRET,
};