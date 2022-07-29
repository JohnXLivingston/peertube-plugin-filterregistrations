const whois = require('whois-json')

async function register ({
  registerHook,
  registerSetting,
  settingsManager,
  storageManager,
  videoCategoryManager,
  videoLicenceManager,
  videoLanguageManager,
  peertubeHelpers
}) {
  registerSetting({
    name: 'displayname_pattern',
    label: 'Forbidden patterns in display name.',
    descriptionHTML: 'One pattern per line. You can specify a case-insensitive substring that should not be allowed (for example «John»), or a regular expression («/forbidden\s*word/i»). You can start a line with a # to add a comment line.',
    type: 'input-textarea',
    private: true,
    default: ''
  })
  registerSetting({
    name: 'username_pattern',
    label: 'Forbidden patterns in username.',
    descriptionHTML: 'One pattern per line. You can specify a case-insensitive substring that should not be allowed (for example «John»), or a regular expression («/forbidden\s*word/i»). You can start a line with a # to add a comment line.',
    type: 'input-textarea',
    private: true,
    default: ''
  })
  registerSetting({
    name: 'email_pattern',
    label: 'Forbidden patterns in email.',
    descriptionHTML: 'One pattern per line. You can specify a case-insensitive substring that should not be allowed (for example «John»), or a regular expression («/forbidden\s*word/i»). You can start a line with a # to add a comment line.',
    type: 'input-textarea',
    private: true,
    default: ''
  })
  registerSetting({
    name: 'error_message',
    label: 'Error message',
    descriptionHTML: 'Error message to display when the registration is forbidden.',
    type: 'input',
    private: true,
    default: 'You cannot register on this instance. Please use the contact form.'
  })

  registerHook({
    target: 'filter:api.user.signup.allowed.result',
    handler: (result, params) => filterRegistration(result, params, settingsManager, peertubeHelpers)
  })
}

async function unregister () {
  return
}

async function filterRegistration(result, params, settingsManager, peertubeHelpers) {
  const logger = peertubeHelpers.logger
  logger.debug('Calling filterRegistration...')
  if (!params || !params.body) {
    logger.debug('This is not a registration form submit. Ignoring.')
    return result
  }

  if (!result) {
    logger.error('The result parameter is falsey. This is unexpected. Check the peertube-plugin-filterregistrations compatibility.')
    return result
  }
  if (!result.allowed) {
    logger.debug('The registration is already refused.')
    return result
  }

  const settings = await settingsManager.getSettings([
    'displayname_pattern',
    'username_pattern',
    'email_pattern',
    'error_message'
  ])

  if (
    !checkValue(logger, params.body.displayName ?? '', settings['displayname_pattern'])
    || !checkValue(logger, params.body.username ?? '', settings['username_pattern'])
    || !checkValue(logger, params.body.email ?? '', settings['email_pattern'])
  ) {
    return { allowed: false, errorMessage: settings['error_message'] }
  }

  return result
}

function checkValue(logger, value, setting) {
  // splitting the setting on new lines...
  let tests = (setting ?? '').split('\n')
  for (const test of tests) {
    if (/^\s*$/.test(test)) {
      // Ignoring empty lines...
      continue
    }
    if (/^\s*#/.test(test)) {
      // Ignoring comments (line starting with #)
      continue
    }
    try {
      // Checking if the line is a RegExp (/something/ or /something/i)
      const testMatch = test.match(/^\s*\/(.*)\/(\w+)?\s*$/)
      if (testMatch) {
        logger.debug('We have a regular expression to test: '+test)
        const regex = new RegExp(testMatch[1], testMatch[2] ? testMatch[2] : undefined)
        if (regex.test(value)) {
          logger.info('The value is matching «'+regex.toString()+'», registration is forbidden')
          return false
        }
      } else {
        logger.debug('We should check if value contains: '+test)
        if (value.toLowerCase().includes(test.toLowerCase())) {
          logger.info('Found «'+test+'» in the value, registration is forbidden')
          return false
        }
      }
    } catch (err) {
      logger.error('Failed to test «'+test+"», please check the plugin filterregistrations configuration.")
    }
  }
  return true
}

module.exports = {
  register,
  unregister
}
