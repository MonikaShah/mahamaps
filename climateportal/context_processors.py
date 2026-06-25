from django.conf import settings


def site_settings(request):
    return {
        "iot_dashboard_url": settings.IOT_DASHBOARD_URL,
    }
