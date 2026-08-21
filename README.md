# occuhealth-website
occuhealth advanced pathology software 

## Verification and Notifications

Copy `.env.example` to `.env` and configure SMTP before enabling email delivery. WhatsApp delivery remains disabled until Meta templates and credentials are configured.

### Getting Meta WhatsApp credentials

1. Create or use a Meta Business account at `business.facebook.com`.
2. In Meta for Developers, create an app and add the **WhatsApp** product.
3. In WhatsApp Manager, add/verify a business phone number and create the approved templates `booking_hold`, `booking_clinical`, and `booking_cancelled`. Each template body should have seven variables in this order: booking ID, patient name, previous status, new status, reason, changed by, changed time.
4. Copy the phone number ID into `WHATSAPP_PHONE_NUMBER_ID` and the WhatsApp Business Account ID into `WHATSAPP_BUSINESS_ACCOUNT_ID`.
5. Create a Meta Business System User, assign the WhatsApp account and messaging permission, then generate a long-lived token. Put it in `WHATSAPP_ACCESS_TOKEN`; never commit it.
6. Configure the webhook URL as `https://YOUR_DOMAIN/api/v1/user/webhooks/whatsapp`, use the random value from `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, and subscribe to WhatsApp message statuses.
7. Set `WHATSAPP_ENABLED=true` only after testing on staging.

Super Admin can control each user's WhatsApp policy through the Clients page. Delivery still requires a verified phone, user opt-in, and a policy that is not disabled.
