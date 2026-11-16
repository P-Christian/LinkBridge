import { getPHTimeString } from "@/lib/utils";

export interface IdentityVerification {
    id: number;
    user_id: number;
    type: 'gov_id' | 'address' | 'mobile_number';
    status: 'pending' | 'approved' | 'rejected';
    submitted_at: string;
    reviewed_at?: string | null;
    reviewed_by?: number | null;
    rejection_note?: string | null;
    gov_id_type?: string | null;
    gov_id_front_image_uuid?: string | null;
    gov_id_selfie_image_uuid?: string | null;
    address_doc_image_uuid?: string | null;
    mobile_number?: string | null;
    mobile_verified?: boolean;
}

function getDirectusConfig() {
    const NEXT_PUBLIC_API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL;
    const DIRECTUS_STATIC_TOKEN = process.env.DIRECTUS_STATIC_TOKEN;
    if (!NEXT_PUBLIC_API_BASE_URL || !DIRECTUS_STATIC_TOKEN) {
        throw new Error("Directus API URL or Static Token is not configured.");
    }
    return { baseUrl: NEXT_PUBLIC_API_BASE_URL, token: DIRECTUS_STATIC_TOKEN };
}

export async function fetchUserVerifications(userId: number): Promise<IdentityVerification[]> {
    const { baseUrl, token } = getDirectusConfig();
    const url = `${baseUrl}/items/vs_identity_verifications?filter[user_id][_eq]=${userId}&sort=-submitted_at`;
    
    const res = await fetch(url, {
        headers: { "Authorization": `Bearer ${token}` },
        cache: "no-store"
    });
    
    if (!res.ok) {
        console.error("Failed to fetch verifications", await res.text());
        return [];
    }
    
    const data = await res.json();
    return data.data || [];
}

export async function createVerificationSubmission(data: Partial<IdentityVerification>): Promise<number> {
    const { baseUrl, token } = getDirectusConfig();
    const url = `${baseUrl}/items/vs_identity_verifications`;
    
    const res = await fetch(url, {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            user_id: data.user_id,
            type: data.type,
            status: data.status || 'pending',
            submitted_at: getPHTimeString(),
            gov_id_type: data.gov_id_type || null,
            gov_id_front_image_uuid: data.gov_id_front_image_uuid || null,
            gov_id_selfie_image_uuid: data.gov_id_selfie_image_uuid || null,
            address_doc_image_uuid: data.address_doc_image_uuid || null,
            mobile_number: data.mobile_number || null,
            mobile_verified: data.mobile_verified ? 1 : 0
        })
    });
    
    if (!res.ok) {
        throw new Error(`Failed to create verification: ${await res.text()}`);
    }
    
    const json = await res.json();
    return json.data.id;
}

export async function deleteExistingVerification(userId: number, type: string): Promise<void> {
    const { baseUrl, token } = getDirectusConfig();
    
    // Fetch existing verifications for this type
    const checkUrl = `${baseUrl}/items/vs_identity_verifications?filter[user_id][_eq]=${userId}&filter[type][_eq]=${type}`;
    const checkRes = await fetch(checkUrl, {
        headers: { "Authorization": `Bearer ${token}` },
        cache: "no-store"
    });
    
    if (!checkRes.ok) return;
    const checkData = await checkRes.json();
    if (!checkData.data || checkData.data.length === 0) return;
    
    for (const record of checkData.data) {
        // Delete the record first to remove foreign key constraints on the files
        const recordDelRes = await fetch(`${baseUrl}/items/vs_identity_verifications/${record.id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${token}` }
        });
        
        if (!recordDelRes.ok) {
            console.error(`Failed to delete record ${record.id}`, await recordDelRes.text());
            continue; // Skip deleting files if we couldn't delete the record
        }

        // Now delete the associated files safely
        const fileIds = [
            record.gov_id_front_image_uuid,
            record.gov_id_selfie_image_uuid,
            record.address_doc_image_uuid
        ].filter(Boolean);
        
        for (const fileId of fileIds) {
            const fileDelRes = await fetch(`${baseUrl}/files/${fileId}`, {
                method: "DELETE",
                headers: { "Authorization": `Bearer ${token}` }
            });
            if (!fileDelRes.ok) {
                console.error(`Failed to delete file ${fileId}`, await fileDelRes.text());
            }
        }
    }
}
