-- Applies the client's email routing. Admin backup is unchanged until the client chooses.
UPDATE public.platform_settings
SET setting_value = setting_value || '{
      "helpSupport": "supportykc@csggroup.co.za",
      "billingInvoices": "invoicesykc@csggroup.co.za",
      "kitchen": "kitchenykc@csggroup.co.za",
      "appSender": "iwantykc@csggroup.co.za",
      "platformMaster": "techykc@csggroup.co.za"
    }'::jsonb,
    updated_at = NOW()
WHERE setting_key = 'email_routing_directory';

SELECT setting_value FROM public.platform_settings WHERE setting_key = 'email_routing_directory';
