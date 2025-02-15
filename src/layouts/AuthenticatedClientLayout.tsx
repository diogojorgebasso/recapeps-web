import { useState } from "react";
import { Box, IconButton } from "@chakra-ui/react";
import { FiMenu } from "react-icons/fi";
import SidebarDesktop from "@/components/sidebar/SidebarDesktop";
import { SidebarMobile } from "@/components/sidebar/sidebarMobile";
import { Outlet } from "react-router";

export default function AuthenticatedClientLayout() {
  const [isMobileOpen, setMobileOpen] = useState(false);

  return (
    <Box>
      {/* Botão e sidebar mobile visíveis apenas em telas base */}
      <IconButton
        display={{ base: "block", md: "none" }}
        title="Open Menu"
        onClick={() => setMobileOpen(true)}
        position="fixed"
        top="20px"
        left="20px"
        zIndex="1000"
        bg="orange.400"
        color="white"
      >
        <FiMenu />
      </IconButton>
      <Box display={{ base: "block", md: "none" }}>
        <SidebarMobile isOpen={isMobileOpen} onOpen={setMobileOpen} />
      </Box>

      {/* Sidebar desktop visível apenas em telas md ou maiores */}
      <Box display={{ base: "none", md: "block" }}>
        <SidebarDesktop />
      </Box>

      <Box
        ml={{ base: 0, md: "100px" }} // Ajusta o espaço conforme o dispositivo
        p="4"
      >
        <Outlet />
      </Box>
    </Box>
  );
}

