#!/bin/bash

# Find the line number where we need to add the button
# Looking for the location div closing in the attendance section

LINE=$(grep -n "session.location || 'Online'" App.jsx | tail -1 | cut -d: -f1)

if [ -z "$LINE" ]; then
    echo "❌ Could not find insertion point"
    exit 1
fi

echo "Found location line at: $LINE"

# Calculate where to insert (a few lines after)
INSERT_LINE=$((LINE + 6))

echo "Will insert button code at line: $INSERT_LINE"

# Create the button code to insert
cat > button-code.txt << 'BUTTON'

                            {/* Mark Attended Button */}
                            {!isCompleted && isPast && (
                              <button 
                                onClick={async () => {
                                  if (window.confirm('Mark this session as attended?')) {
                                    try {
                                      const result = await api.updateSessionStatus(session.id, 'completed');
                                      if (result.success) {
                                        alert('✅ Session marked as attended!');
                                        loadClientDetails();
                                      }
                                    } catch (err) {
                                      alert('Error updating session');
                                      console.error(err);
                                    }
                                  }
                                }}
                                className="px-3 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 transition-colors">
                                ✓ Mark Attended
                              </button>
                            )}
BUTTON

# Insert it
sed -i "${INSERT_LINE}r button-code.txt" App.jsx

echo "✅ Button code inserted"

# Verify
if grep -q "Mark Attended" App.jsx; then
    echo "✅✅ 'Mark Attended' button successfully added!"
else
    echo "❌ Button insertion failed"
fi

rm button-code.txt
