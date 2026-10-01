#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib/core';
import { RetoTecnicoAjeStack } from '../lib/reto-tecnico-aje-stack';

const app = new cdk.App();
new RetoTecnicoAjeStack(app, 'RetoTecnicoAjeStack', {
  alertEmailRecipient: 'jorregoj96@gmail.com',
  googleSheetsWebhookUrl: 'https://script.google.com/macros/s/AKfycbwMwFlagIqjhWyduOm4-MuhcIcOeu5v-gqi4FB2KwA4934a5nJGp-x6qo4c4TQV-rSU/exec'
  /* If you don't specify 'env', this stack will be environment-agnostic.
   * Account/Region-dependent features and context lookups will not work,
   * but a single synthesized template can be deployed anywhere. */

  /* Uncomment the next line to specialize this stack for the AWS Account
   * and Region that are implied by the current CLI configuration. */
  // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

  /* Uncomment the next line if you know exactly what Account and Region you
   * want to deploy the stack to. */
  // env: { account: '123456789012', region: 'us-east-1' },

  /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
});
