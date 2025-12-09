// PDF Links Mapping for A311
// Based on actual available PDFs from actuarialsociety.org.za
const pdfLinksMap = {
    'A311': {
        'JUNE': {
            '2025': {
                '1': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/08/A311a_S1_2025_Exam.pdf', 
                '2': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/08/A311b_S1_2025_Exam.pdf' 
            },
            '2024': {
                '1': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-JUNE-2024-PAPER-1-EXAM-1.pdf',
                '2': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-JUNE-2024-PAPER-2-EXAM-1.pdf'
            },
            '2023': {
                '1': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-JUNE-2023-PAPER-1-EXAM-1.pdf',
                '2': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-JUNE-2023-PAPER-2-EXAM-1.pdf'
            },
            '2022': {
                '1': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-JUNE-2022-PAPER-1-EXAM-1.pdf',
                '2': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-JUNE-2022-PAPER-2-EXAM-1.pdf'
            },
            '2021': {
                '1': null, // Not available
                '2': null  // Not available
            },
            '2020': {
                '1': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-JUNE-2020-EXAM-1.pdf',
                '2': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-JUNE-2020-EXAM-2.pdf'
            },
            '2019': {
                '1': null, // Not available
                '2': null  // Not available
            },
            '2018': {
                '1': null, // Only A301 available, not A311
                '2': null  // Only A301 available, not A311
            }
        },
        'NOVEMBER': {
            '2024': {
                '1': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-NOVEMBER-2024-A311A-NOVEMBER-2024-EXAM.pdf',
                '2': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-NOVEMBER-2024-A311B-NOVEMBER-2024-EXAM.pdf'
            },
            '2023': {
                '1': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-NOVEMBER-2023-PAPER-1-EXAM-1.pdf',
                '2': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-NOVEMBER-2023-PAPER-2-EXAM-1.pdf'
            },
            '2022': {
                '1': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-NOVEMBER-2022-PAPER-1-EXAM-1.pdf',
                '2': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-NOVEMBER-2022-PAPER-2-EXAM-1.pdf'
            },
            '2021': {
                '1': null, // Only examiners report available
                '2': null  // Only examiners report available
            },
            '2020': {
                '1': null, // Not available
                '2': null  // Not available
            },
            '2019': {
                '1': null, // Only examiners report available
                '2': null  // Only examiners report available
            },
            '2018': {
                '1': null, // Not available
                '2': null  // Not available
            }
        },
        'OCTOBER': {
            // Alias for NOVEMBER since some UI might use "October"
            '2024': {
                '1': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-NOVEMBER-2024-A311A-NOVEMBER-2024-EXAM.pdf',
                '2': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-NOVEMBER-2024-A311B-NOVEMBER-2024-EXAM.pdf'
            },
            '2023': {
                '1': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-NOVEMBER-2023-PAPER-1-EXAM-1.pdf',
                '2': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-NOVEMBER-2023-PAPER-2-EXAM-1.pdf'
            },
            '2022': {
                '1': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-NOVEMBER-2022-PAPER-1-EXAM-1.pdf',
                '2': 'https://www.actuarialsociety.org.za/wp-content/uploads/2025/07/A311-NOVEMBER-2022-PAPER-2-EXAM-1.pdf'
            },
            '2021': {
                '1': null,
                '2': null
            },
            '2020': {
                '1': null,
                '2': null
            },
            '2019': {
                '1': null,
                '2': null
            },
            '2018': {
                '1': null,
                '2': null
            }
        }
    }
    // Can add other subjects here later when their PDF links are available
};

// Function to get PDF link for a given paper
function getPDFLink(subject, session, year, paper) {
    try {
        let sessionUpper = session.toUpperCase();
        
        // Handle OCTOBER as alias for NOVEMBER
        if (sessionUpper === 'OCTOBER') {
            sessionUpper = 'NOVEMBER';
        }
        
        // Navigate through the nested structure
        if (pdfLinksMap[subject] && 
            pdfLinksMap[subject][sessionUpper] && 
            pdfLinksMap[subject][sessionUpper][year]) {
            
            const link = pdfLinksMap[subject][sessionUpper][year][paper];
            
            // Return the link if it exists and is not null
            return link || null;
        }
        
        return null;
    } catch (error) {
        console.error('Error getting PDF link:', error);
        return null;
    }
}

// Function to check if PDF exists for given paper
function hasPDFLink(subject, session, year, paper) {
    const link = getPDFLink(subject, session, year, paper);
    return link !== null && link !== undefined;
}
