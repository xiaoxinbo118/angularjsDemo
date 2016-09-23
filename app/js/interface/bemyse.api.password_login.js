angular
  .module('inspinia')
  .value('bemyse_api_password_login', {
      api: {
        METHOD_NAME: 'account/password-login',
        SECURITY_TYPE: 'None',
        REQUIRED: {
          'phone': 'string',
          'password': 'string',
        },
        OPTIONAL: {
        },
        VERIFY:{
        },
        ERROR_CODE: {
        }
      }
    });