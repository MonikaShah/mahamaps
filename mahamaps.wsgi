# Use Django as the WSGI application (this project is Django-only).
# Deploy this file to the server and point Apache/mod_wsgi to it instead of app:app.

import os
import sys

# Project root = directory containing this .wsgi file (e.g. /home/mahamaps)
PROJECT_ROOT = os.path.dirname(os.path.abspath(__file__))
if PROJECT_ROOT not in sys.path:
    sys.path.insert(0, PROJECT_ROOT)

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'climateportal.settings')

from django.core.wsgi import get_wsgi_application
application = get_wsgi_application()
