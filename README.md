# SDR Mini CRM MVP

A modern SaaS CRM application built for sales development representatives, featuring multi-workspace support, lead management, and campaign automation.

## Features

- **Multi-Workspace Support**: Create and switch between multiple workspaces
- **Authentication**: Secure email/password authentication with Supabase
- **Lead Management**: Kanban-style board to manage leads through pipeline stages
- **Custom Fields**: Add custom fields to leads for flexible data capture
- **Campaigns**: Create and manage automated outreach campaigns
- **Dashboard**: Real-time metrics and pipeline visualization
- **Row Level Security**: Built-in RLS policies for data isolation

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 + shadcn/ui
- **Database**: Supabase (PostgreSQL + Auth)
- **State Management**: React Context + localStorage

## Getting Started

### Prerequisites

- Node.js 18+
- A Supabase project ([create one here](https://supabase.com))

### Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
NEXT_PUBLIC_DEV_SUPABASE_REDIRECT_URL=http://localhost:3000
```

### Database Setup

1. In your Supabase project, go to the SQL Editor
2. Run the scripts in the `scripts` folder in order:
   - `001-initial-schema.sql` - Creates tables and RLS policies
   - `002-rpc-functions.sql` - Creates the workspace creation RPC function

### Installation

```bash
# Install dependencies
npm install

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Project Structure

```
├── app/
│   ├── auth/                 # Authentication pages
│   ├── onboarding/          # Workspace selection/creation
│   ├── app/                 # Main application (protected routes)
│   │   ├── dashboard/       # Dashboard with metrics
│   │   ├── leads/           # Lead kanban board & detail pages
│   │   ├── campaigns/       # Campaign management
│   │   └── settings/        # Settings page
│   └── layout.tsx           # Root layout with providers
├── components/              # Reusable React components
│   ├── ui/                  # shadcn/ui components
│   ├── app-sidebar.tsx      # Main navigation sidebar
│   ├── app-topbar.tsx       # Top bar with workspace switcher
│   └── ...                  # Feature-specific components
├── lib/
│   ├── supabase/            # Supabase client helpers
│   ├── types.ts             # TypeScript interfaces
│   └── workspace-context.tsx # Workspace state management
├── scripts/                 # Database migration scripts
└── proxy.ts                 # Auth middleware (Next.js 16)
```

## Key Concepts

### Workspace Management

- Users can create multiple workspaces
- Current workspace is persisted in localStorage
- All data queries are filtered by workspace_id
- RLS policies ensure users only see their workspace data

### Lead Pipeline

- Leads move through customizable pipeline stages
- Each workspace has default stages created automatically
- Stage colors and sort order are customizable
- Kanban board provides visual pipeline management

### Custom Fields

- Define custom fields per workspace
- Support for text, number, date, and select field types
- Values are stored separately for flexibility
- Displayed dynamically on lead detail pages

### Campaigns

- Store campaign configurations (name, context, prompt)
- Optional trigger stage for automation
- Active/inactive status toggle
- Ready for future AI integration

## Security

- Row Level Security (RLS) enforced on all tables
- Users can only access workspaces they're members of
- Authentication required for all protected routes
- Secure session management via Supabase Auth

## Future Enhancements

- Drag-and-drop lead movement between stages
- User invitations and team collaboration
- AI-powered campaign message generation
- Activity timeline and notes
- Email integration
- Reporting and analytics

## License

MIT
