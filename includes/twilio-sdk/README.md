# Twilio SDK Installation

This directory should contain the Twilio PHP SDK.

## Installation Instructions

1. Download the Twilio PHP SDK from: https://github.com/twilio/twilio-php
2. Extract the contents and copy the `src/Twilio/` folder to this directory
3. The final structure should be:
   ```
   includes/twilio-sdk/
   └── src/
       └── Twilio/
           ├── autoload.php
           ├── Rest/
           ├── Exceptions/
           └── ... (other Twilio files)
   ```

## Required Files

The plugin expects the following file to exist:
- `includes/twilio-sdk/src/Twilio/autoload.php`

## PHP Requirements

- PHP 7.4 or higher
- cURL extension enabled
- OpenSSL extension enabled

## Testing

After installation, test the SMS functionality in Test Mode first, then switch to Production Mode with valid Twilio credentials.