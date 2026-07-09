const API_ROOT = process.env.REACT_APP_API_URL || '';

export async function fetchAvailableSlots() {
    try {
        const res = await fetch(`${API_ROOT}/api/slots`);
        if (!res.ok) throw new Error('Network');
        return await res.json();
    } catch (e) {
        // fallback mock
        return {
            instant: { etaMinutes: 50 },
            dates: [
                { date: new Date().toISOString(), times: ['04:30 PM','05:00 PM','05:30 PM'] },
            ]
        };
    }
}

export async function createBooking(payload) {
    const res = await fetch(`${API_ROOT}/api/bookings`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Booking failed');
    return res.json();
}

export default { fetchAvailableSlots, createBooking };
