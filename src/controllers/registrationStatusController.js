
import {
    getRegistrationStatus,
} from "../services/authService.js";

export const checkRegistrationStatus = async (req, res) => {
    try {
        const status = await getRegistrationStatus();

        return res.status(200).json({
            success: true,
            data: status,
        });
    } catch (error) {
        console.error(
            "Registration status controller error:",
            error.message
        );

        return res.status(500).json({
            success: false,
            message: "Unable to check registration status.",
        });
    }
};
