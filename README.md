# COD Verifier for WooCommerce - Multi-Country Edition with Razorpay Token Verification

A comprehensive WordPress plugin that adds multi-country OTP and secure ₹1 token payment verification for Cash on Delivery (COD) orders in WooCommerce with Twilio SMS and Razorpay integration.

## 🌍 Multi-Country Features

### Supported Countries
- **🇮🇳 India (+91)** - Existing functionality preserved
- **🇺🇸 USA (+1)** - New support added
- **🇬🇧 UK (+44)** - New support added

### Key Enhancements
- **Country Code Dropdown**: Users select country before entering phone number
- **30-Second OTP Timer**: Prevents spam with visual countdown and button state changes
- **Regional Restrictions**: Admin can limit allowed countries (Global, India, USA, UK)
- **Enhanced Validation**: E.164 format validation for all countries
- **Improved UX**: Better error messages and user guidance

## 💳 NEW: Razorpay Token Verification

### Secure ₹1 Token Payment Flow
- **Live Razorpay Integration**: Real payments with automatic refunds
- **Device-Responsive UI**: Mobile popup vs Desktop QR code
- **Auto-Refund System**: ₹1 automatically refunded after verification
- **2-Minute Expiry**: Payment sessions expire for security
- **Signature Verification**: Secure backend validation

### Device Detection & UI Switching
- **Mobile (≤768px)**: Razorpay popup with "Pay Now" button
- **Desktop (>768px)**: QR code for UPI app scanning
- **Smart Timer**: 2-minute countdown with automatic expiry
- **Trust Messages**: Clear security and refund information

## 🚀 Core Features

### Multi-Country OTP Verification
- **Twilio SMS Integration**: Reliable international SMS delivery
- **E.164 Format**: Proper international phone number handling
- **Country-Specific Validation**: Different rules for each country
- **Timer with Visual Feedback**: 30-second cooldown with color changes

### Secure Token Payment
- **Production-Ready**: Real Razorpay integration with live payments
- **Auto-Refund**: ₹1 refunded immediately after verification
- **Device Detection**: Automatic UI switching based on screen size
- **Security**: Razorpay signature verification and secure key storage

### Admin Configuration
- **Regional Controls**: Limit countries based on business needs
- **Secure Key Storage**: API keys masked in UI, securely stored
- **Test/Production Modes**: Safe testing before going live
- **Timer Configuration**: Adjustable OTP cooldown (15-120 seconds)

## 🔧 Technical Implementation

### Phone Number Validation Rules
- **India (+91)**: 10 digits starting with 6-9 (e.g., +917039940998)
- **USA (+1)**: 10 digits starting with 2-9 (e.g., +12125551234)  
- **UK (+44)**: 10 digits starting with 7 (e.g., +447700900123)

### Razorpay Integration
- **Order Creation**: Secure backend order generation
- **Payment Processing**: Live Razorpay checkout integration
- **Signature Verification**: Server-side payment validation
- **Auto-Refund**: Immediate ₹1 refund via Razorpay API

### Device-Responsive Logic
```javascript
function isMobileDevice() {
    return window.innerWidth <= 768;
}

// Mobile: Show Razorpay popup
// Desktop: Show QR code for UPI scanning
```

### Timer Functionality
- **OTP Timer**: 30-second countdown with visual feedback
- **Token Timer**: 2-minute payment session with auto-expiry
- **Button States**: Disabled during cooldown, color changes
- **Smart Reset**: Timers clear on successful verification

## 📦 Installation & Setup

### Step 1: Install Plugin
1. Download/create the `cod-verifier` folder with all files
2. **Install Twilio SDK** (see Step 1.5 below)
3. Upload to WordPress and activate

### Step 1.5: Install Twilio SDK (CRITICAL)
1. Download Twilio PHP SDK from: https://github.com/twilio/twilio-php
2. Extract and copy the `src/Twilio/` folder to `includes/twilio-sdk/src/Twilio/`
3. Ensure this file exists: `includes/twilio-sdk/src/Twilio/autoload.php`

### Step 2: Configure Multi-Country & Razorpay Settings
1. Go to **WooCommerce → COD Verifier** in admin menu
2. **Enable Test Mode** (recommended for initial setup)
3. **Choose Allowed Regions**:
   - 🌍 Global (India, USA, UK)
   - 🇮🇳 India Only
   - 🇺🇸 USA Only
   - 🇬🇧 UK Only
4. **Configure Twilio Settings**:
   - Account SID
   - Auth Token
   - Phone Number (must support your selected regions)
5. **Configure Razorpay Settings**:
   - Key ID (masked in UI for security)
   - Key Secret (securely stored, never displayed)
   - Test/Live Mode toggle
6. **Set Timer Duration**: Default 30 seconds (15-120 seconds allowed)
7. Save settings

### Step 3: Test Complete Flow
1. Go to your WooCommerce checkout page
2. Add any product to cart and proceed to checkout
3. Select **"Cash on Delivery"** as payment method
4. **Test Multi-Country OTP**:
   - Select different countries from dropdown
   - Test phone validation for each country
   - Verify 30-second timer works
5. **Test Token Payment**:
   - Click "Pay ₹1 Token"
   - **Mobile**: Should show Razorpay popup
   - **Desktop**: Should show QR code
   - **Test Mode**: Payment simulated, no real charge
6. Complete order verification

## 🔒 Security Features

### API Key Protection
- **Masked UI**: Keys never displayed in admin interface
- **Secure Storage**: Keys stored encrypted in database
- **No Frontend Exposure**: Keys never sent to client-side

### Payment Security
- **Razorpay Signatures**: All payments verified server-side
- **Auto-Refund**: ₹1 refunded immediately after verification
- **Session Expiry**: 2-minute payment window prevents abuse
- **Nonce Verification**: All AJAX requests secured

### Phone Validation
- **E.164 Format**: International standard phone formatting
- **Country Validation**: Server-side region checking
- **Rate Limiting**: OTP timer prevents spam
- **Session Management**: Secure OTP storage and expiry

## 🧪 Testing Guide

### Test Mode Features
- **OTP Display**: OTP shown in JavaScript alert for all countries
- **Payment Simulation**: No real money charged in test mode
- **Timer Functionality**: All timers work in test mode
- **Device Detection**: UI switching works in test mode

### Production Setup
1. **Twilio Configuration**:
   - Ensure phone number supports target countries
   - Test SMS delivery for each region
   - Verify sufficient account balance
2. **Razorpay Configuration**:
   - Use live API keys for production
   - Test real ₹1 payments and refunds
   - Verify webhook endpoints if needed
3. **Switch Modes**: Disable test mode when ready

## 🔧 Device-Specific Testing

### Mobile Testing (≤768px)
1. Resize browser to mobile width
2. Click "Pay ₹1 Token"
3. Should see Razorpay popup
4. Trust message: "🔒 Secure Payment · ₹1 will be refunded"

### Desktop Testing (>768px)
1. Use desktop browser width
2. Click "Pay ₹1 Token"
3. Should see QR code display
4. Trust message: "🛈 Scan QR code with any UPI app"

## ⚠️ Important Notes

### Backward Compatibility
- **No Breaking Changes**: Existing Indian users unaffected
- **Default Settings**: Plugin defaults preserve current behavior
- **Gradual Migration**: Enable multi-country when ready

### Production Requirements
- **Twilio Account**: With international SMS capabilities
- **Razorpay Account**: With live API keys and webhook setup
- **SSL Certificate**: Required for secure payment processing
- **Server Requirements**: PHP 7.4+, WordPress 5.0+, WooCommerce 3.0+

### Cost Considerations
- **Twilio SMS**: Charges per SMS sent (varies by country)
- **Razorpay Fees**: Standard payment processing fees apply
- **Auto-Refunds**: Refund fees may apply (check Razorpay terms)

## 🛠️ Troubleshooting

### Common Issues
1. **OTP Not Received**: Check Twilio configuration and balance
2. **Payment Fails**: Verify Razorpay keys and mode settings
3. **Timer Not Working**: Check JavaScript console for errors
4. **Wrong Country Options**: Verify allowed regions setting
5. **QR Code Not Showing**: Check device width detection

### Debug Mode
Enable WordPress debug mode in `wp-config.php`:
```php
define('WP_DEBUG', true);
define('WP_DEBUG_LOG', true);
```

Check `/wp-content/debug.log` for errors.

## 📝 Changelog

### Version 1.3.0 (Razorpay Token Edition)
- **NEW**: Secure ₹1 Razorpay token payment verification
- **NEW**: Device-responsive UI (mobile popup vs desktop QR)
- **NEW**: Auto-refund system for token payments
- **NEW**: 2-minute payment session timer
- **NEW**: Secure API key storage with masked UI
- **ENHANCED**: Production-ready payment processing
- **ENHANCED**: Comprehensive security measures
- **PRESERVED**: All existing OTP and multi-country functionality

### Version 1.2.0 (Multi-Country Edition)
- **NEW**: Multi-country support (India, USA, UK)
- **NEW**: Country code dropdown with flags
- **NEW**: 30-second OTP resend timer with visual feedback
- **NEW**: Regional restrictions (Global, India, USA, UK)
- **NEW**: Enhanced phone number validation for all countries
- **NEW**: E.164 format support
- **IMPROVED**: Better error messages and user guidance
- **IMPROVED**: Enhanced Twilio integration for international SMS
- **PRESERVED**: All existing Indian functionality remains intact

## 📄 License

This plugin is licensed under GPL v2 or later.

---

**Ready to sell fake-order-free COD products globally with secure token verification?** 🌍💳🚀

Test the complete flow in Test Mode with all supported countries and payment methods, then switch to Production Mode with your Twilio and Razorpay credentials for real international customers with secure token verification!