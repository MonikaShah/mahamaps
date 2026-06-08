from django.contrib import admin
from .models import SiteSection

@admin.register(SiteSection)
class SiteSectionAdmin(admin.ModelAdmin):
    list_display = ('title', 'slug')
    prepopulated_fields = {
        'slug': ('title',)
    }


# @admin.register(TeamMember)
# class TeamMemberAdmin(admin.ModelAdmin):
#     list_display = (
#         'name',
#         'designation',
#         'category',
#         'display_order',
#         'is_active'
#     )

#     list_filter = (
#         'category',
#         'is_active'
#     )

#     search_fields = (
#         'name',
#         'designation',
#         'research_topic'
#     )

#     ordering = (
#         'display_order',
#         'name'
#     )


# @admin.register(Publication)
# class PublicationAdmin(admin.ModelAdmin):
#     list_display = (
#         'title',
#         'year',
#         'journal'
#     )

#     search_fields = (
#         'title',
#         'authors',
#         'journal'
#     )

#     ordering = (
#         '-year',
#     )