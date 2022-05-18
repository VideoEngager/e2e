process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const environments = {
  dev: {
    pak: 'DEV2',
    externalId: 'videoEngager',
    firstName: 'name',
    lastName: 'last',
    email: 't@t',
    password: '1',
    userName: 't',
    id: '123',
    subject: 'subj',
    hideChat: true,
    hideInfo: true,
    baseURL: 'https://dev.videoengager.com',
    organizationId: '327d10eb-0826-42cd-89b1-353ec67d33f8',
    deploymentId: 'c2eaaa5c-d755-4e51-9136-b5ee86b92af3',
    clientId: 'SOME_ID',
    tennantId: 'test_tenant',
    environment: 'https://api.mypurecloud.com.au',
    queue: 'video',
    logLevel: 'debug'
  },
  test: {
    pak: 'DEV2',
    externalId: 'videoEngager',
    firstName: 'name',
    lastName: 'last',
    email: 't@t',
    password: '1',
    userName: 't',
    id: '123',
    subject: 'subj',
    hideChat: true,
    hideInfo: true,
    baseURL: 'http://localhost:9000',
    organizationId: '327d10eb-0826-42cd-89b1-353ec67d33f8',
    deploymentId: 'c2eaaa5c-d755-4e51-9136-b5ee86b92af3',
    clientId: 'SOME_ID',
    tennantId: 'test_tenant',
    environment: 'https://api.mypurecloud.com.au',
    queue: 'video',
    logLevel: 'debug'
  },
  staging: {
    pak: 'c50859ee-fda4-258b-6c34-d77566373a7b',
    externalId: 'Home',
    firstName: 'Slav',
    lastName: 'Hadjidimitrov',
    email: 'f6668859-042a-4b04-b998-3e3261fb3dd4slav@videoengager.com',
    password: '123456',
    userName: 't',
    id: '123',
    subject: 'subj',
    hideChat: true,
    hideInfo: true,
    baseURL: 'https://staging.leadsecure.com',
    organizationId: 'f6668859-042a-4b04-b998-3e3261fb3dd4',
    deploymentId: '1b4b1124-b51c-4c38-899f-3a90066c76cf',
    clientId: 'SOME_ID',
    tennantId: 'IF9UduUVaQ3ldy8N',
    environment: 'https://api.mypurecloud.de',
    queue: 'Support',
    logLevel: 'warn'
  },
  preproduction: {
    pak: 'c50859ee-fda4-258b-6c34-d77566373a7b',
    externalId: 'Home',
    firstName: 'Slav',
    lastName: 'Hadjidimitrov',
    email: 'f6668859-042a-4b04-b998-3e3261fb3dd4slav@videoengager.com',
    password: '123456',
    userName: 't',
    id: '123',
    subject: 'subj',
    hideChat: true,
    hideInfo: true,
    baseURL: 'https://stage-videome.leadsecure.com',
    organizationId: 'f6668859-042a-4b04-b998-3e3261fb3dd4',
    deploymentId: '1b4b1124-b51c-4c38-899f-3a90066c76cf',
    clientId: 'SOME_ID',
    tennantId: 'IF9UduUVaQ3ldy8N',
    environment: 'https://api.mypurecloud.de',
    queue: 'Support',
    logLevel: 'warn'
  },
  production: {
    pak: 'd41cdd4e-4806-cab7-2b5d-4c3eae2470a8',
    externalId: 'videoEngager',
    firstName: 'Mr',
    lastName: 'Agent',
    email: 'pureclouddemo@videoengager.com',
    password: '123456',
    userName: 't',
    id: '123',
    subject: 'subj',
    hideChat: true,
    hideInfo: true,
    baseURL: 'https://videome.leadsecure.com',
    organizationId: '42ef203c-4d40-44e5-8a6e-d978b52f678c',
    deploymentId: '973f8326-c601-40c6-82ce-b87e6dafef1c',
    clientId: 'SOME_ID',
    tennantId: 'zwqqsB7k16V0YBpW',
    environment: 'https://api.mypurecloud.com',
    queue: 'TestQueue',
    logLevel: 'warn'
  }
};
const env = process.env.NODE_ENV || 'test';
module.exports = {
  env: env,
  // Server port
  port: process.env.PORT || 3000,
  logger: {
    exportToFile: false,
    exportToFilePath: './output.csv',
    level: 'debug',
    levels: {
      trace: 0,
      debug: 1,
      info: 2,
      warn: 3,
      error: 4
    },
    colors: {
      trace: 'magenta',
      debug: 'blue',
      info: 'green',
      warn: 'yellow',
      error: 'red'
    },
    transports: [
      {
        type: 'console',
        colorize: true,
        level: environments[env].logLevel,
        timestamp: true
      }
    ]
  },
  // 50 seconds
  timeout: 1000 * 5 * 10,
  test_env: environments[env]
};
