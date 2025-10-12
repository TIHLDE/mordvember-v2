-- Mordvember Participants Table Schema
-- Run this in your Supabase SQL Editor

-- Create participants table
CREATE TABLE IF NOT EXISTS participants (
  id SERIAL PRIMARY KEY,
  player INTEGER UNIQUE NOT NULL,
  name VARCHAR(255) NOT NULL,
  study VARCHAR(255) NOT NULL,
  class VARCHAR(255) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'alive' CHECK (status IN ('alive', 'dead')),
  image_url VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on player field for faster lookups
CREATE INDEX IF NOT EXISTS idx_participants_player ON participants(player);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_participants_status ON participants(status);

-- Enable Row Level Security (RLS)
ALTER TABLE participants ENABLE ROW LEVEL SECURITY;

-- Policy: Allow public read access (for front page)
CREATE POLICY "Allow public read access" ON participants
  FOR SELECT
  USING (true);

-- Policy: Allow authenticated users to insert/update/delete (for admin)
-- Note: You'll need to set up Supabase auth or use service role key for admin operations
CREATE POLICY "Allow authenticated users full access" ON participants
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to call the function before update
CREATE TRIGGER update_participants_updated_at
  BEFORE UPDATE ON participants
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

