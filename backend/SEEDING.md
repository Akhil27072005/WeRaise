# Database Seeding Script

This script populates the PostgreSQL database with comprehensive mock data for testing the crowdfunding platform's frontend complexity and performance.

## Overview

The `seed.ts` script generates realistic mock data including:

- **20 Users**: Mix of creators and backers with diverse profiles
- **15 Campaigns**: Various categories with proper status distribution
  - 50% Successfully Funded (completed)
  - 30% Active campaigns
  - 20% Failed campaigns
- **45-75 Reward Tiers**: 3-5 tiers per campaign with realistic pledge amounts
- **200 Pledges**: Distributed across campaigns and reward tiers
- **45-75 Campaign Updates**: 3-5 updates per active/successful campaign

## Prerequisites

1. Ensure your Supabase database is set up with the schema from `models/schema.sql`
2. Configure your `.env` file with Supabase credentials:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   # OR
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

## Usage

### Run the seeding script:

```bash
# From the backend directory
npm run seed
```

### Or run directly with ts-node:

```bash
# From the backend directory
npx ts-node seed.ts
```

## Script Features

### Data Generation
- **Realistic User Profiles**: Names, bios, locations, avatars
- **Diverse Campaigns**: Tech, education, community, environment, arts, wellness, food, fashion
- **Proper Status Distribution**: Matches real-world crowdfunding patterns
- **Realistic Pledge Amounts**: Based on reward tier values
- **Comprehensive Updates**: Various types of campaign communications

### Database Operations
- **Safe Data Clearing**: Truncates existing data before seeding
- **Foreign Key Compliance**: Inserts data in correct order to respect constraints
- **Batch Processing**: Handles large datasets efficiently
- **Error Handling**: Comprehensive error reporting and rollback

### Execution Flow
1. Clear existing data from all tables
2. Generate mock data structures
3. Insert users (no dependencies)
4. Insert campaigns (depends on users)
5. Insert reward tiers (depends on campaigns)
6. Insert pledges (depends on campaigns, users, reward tiers)
7. Insert campaign updates (depends on campaigns)

## Data Structure

### Users
- Mix of creators (8) and backers (12)
- Realistic profiles with avatars, bios, locations
- Proper verification status distribution

### Campaigns
- 15 diverse campaigns across 8 categories
- Realistic funding goals ($25K - $150K)
- Proper date ranges and durations
- Mix of funding types (all-or-nothing vs keep-it-all)

### Reward Tiers
- 3-5 tiers per campaign
- Realistic pledge amounts ($10 - $1000)
- Limited quantity options
- Estimated delivery dates

### Pledges
- 200 total pledges
- Realistic distribution across campaigns
- Various statuses (confirmed, pending, cancelled)
- Complete shipping information

### Campaign Updates
- 3-5 updates per active/successful campaign
- Various update types (progress, team, milestones, community)
- Optional images and public visibility

## Customization

The script is designed to be easily customizable:

- Modify `generateUsers()` to change user count or profiles
- Update `generateCampaigns()` to add new campaign templates
- Adjust `generateRewardTiers()` for different tier structures
- Customize `generatePledges()` for different pledge patterns
- Modify `generateCampaignUpdates()` for different update types

## Error Handling

The script includes comprehensive error handling:
- Database connection validation
- Foreign key constraint compliance
- Batch processing for large datasets
- Detailed logging and progress reporting
- Graceful failure with rollback information

## Performance Considerations

- Uses batch processing for large datasets
- Implements efficient data generation algorithms
- Includes progress logging for long-running operations
- Optimized for Supabase's PostgreSQL backend

## Output

The script provides detailed logging:
- Progress indicators for each step
- Success/failure status for each operation
- Final summary with data counts
- Error messages with context for debugging

## Example Output

```
🌱 Starting database seeding...
=====================================
🗑️  Clearing existing data...
✅ Data cleared successfully
📊 Generating mock data...
👥 Inserting users...
✅ Inserted 20 users
🎯 Inserting campaigns...
✅ Inserted 15 campaigns
🎁 Inserting reward tiers...
✅ Inserted 60 reward tiers
💰 Inserting pledges...
📦 Inserted batch 1/4
📦 Inserted batch 2/4
📦 Inserted batch 3/4
📦 Inserted batch 4/4
✅ Inserted 200 pledges
📝 Inserting campaign updates...
✅ Inserted 60 campaign updates
=====================================
🎉 Database seeding completed successfully!
📈 Summary:
   • 20 users created
   • 15 campaigns created
   • 60 reward tiers created
   • 200 pledges created
   • 60 campaign updates created
=====================================
✅ Seeding script completed
```

This seeding script provides a solid foundation for testing your crowdfunding platform's frontend with realistic, comprehensive data.
