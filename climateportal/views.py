from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.conf import settings
from .models import SiteSection 

def home(request):
    return render(request, 'home.html', {"iot_dashboard_url": settings.IOT_DASHBOARD_URL})
@csrf_exempt
def gwpz_view(request):
    return render(request, "gwpz.html")
def ff_view(request):
    return render(request, "forestfire.html")



def about_team(request):

    context = {
        'overview':
            SiteSection.objects.filter(
                slug='overview'
            ).first(),

        'research':
            SiteSection.objects.filter(
                slug='research'
            ).first(),

        'contact':
            SiteSection.objects.filter(
                slug='contact'
            ).first(),

        # 'pi':
        #     TeamMember.objects.filter(
        #         category='pi'
        #     ).first(),

        # 'current_members':
        #     TeamMember.objects.filter(
        #         category='current'
        #     ),

        # 'alumni':
        #     TeamMember.objects.filter(
        #         category='alumni'
        #     ),

        # 'publications':
        #     Publication.objects.order_by('-year')
    }

    return render(
        request,
        'about_team.html',
        context
    )