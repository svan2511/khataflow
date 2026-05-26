require('dotenv').config();

const API_URL = process.env.API_URL || 'http://192.168.1.9:8000/api';

export default ({ config }) => ({
  ...config,
  extra: {
    ...config.extra,
    apiUrl: API_URL,
  },
});
