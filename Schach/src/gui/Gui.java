package gui;

import actions.MouseHandler;
import actions.MouseMotionHandler;
import application.Client;
import application.Main;
import application.Server;
import game.*;

import javax.swing.*;
import java.awt.*;


public class Gui {
    JFrame jf;
    Draw draw;
    public static JTextField ipInput, portInput;
    public static JButton changeColor;
    public static int width = 1024, height = 768;
    public static int fieldx = width / 2 - 320, fieldy = height / 2 - 360, fieldsize = 640;

    public void create() {
        jf = new JFrame("Schach");
        jf.setSize(width, height);
        jf.setLocationRelativeTo(null);
        jf.setLayout(null);
        jf.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        jf.setResizable(false);

        ipInput = new JTextField("127.0.0.1");
        ipInput.setBounds(10, 415, 100, 20);
        ipInput.setVisible(false);

        portInput = new JTextField("5000");
        portInput.setBounds(10, 473, 100, 20);
        portInput.setVisible(false);

        changeColor = new JButton("<=>");
        changeColor.setBounds(100,560,35,20);
        changeColor.setFocusPainted(false);
        changeColor.setBackground(new Color(233, 203, 168));
        changeColor.setBorder(BorderFactory.createLineBorder(Color.BLACK));
        changeColor.addActionListener(e->{Board.serverWhite =! Board.serverWhite;});
        changeColor.setVisible(false);


        JMenuBar bar = new JMenuBar();

        JMenu menu = new JMenu("Spiel");
        JMenu mult = new JMenu("Mehrspieler");

        JMenuItem item = new JMenuItem("Zurücksetzen");
        item.addActionListener(e -> {
            Board.reset();
            Board.refreshMoves();
        });

        JMenuItem multActItem = new JMenuItem("Aktivieren");
        multActItem.addActionListener(e -> {
            Main.connected = false;
            Main.waiting = false;
            Main.multRunning = true;

            ipInput.setVisible(true);
            ipInput.setEnabled(true);
            portInput.setVisible(true);
            portInput.setEnabled(true);
            if(Main.isServer){
                changeColor.setVisible(true);
            }

        });

        JMenuItem clientItem = new JMenuItem("Client starten");
        clientItem.addActionListener(e -> {
            if (Main.multRunning) {
                Main.waiting = true;
                Main.isServer = false;
                Main.serverIp = ipInput.getText();
                Main.port = Integer.valueOf(portInput.getText());
                Client client = new Client(Main.serverIp, Main.port);
            }
        });

        JMenuItem serverItem = new JMenuItem("Server hosten");
        serverItem.addActionListener(e -> {
            if (Main.multRunning) {
                Main.waiting = true;
                Main.port = Integer.valueOf(portInput.getText());
                Main.isServer = true;
                Server server = new Server(Main.port);
            }
        });

        JMenuItem beenden = new JMenuItem("Verbindung trennen");
        beenden.addActionListener(e -> {
            if (Main.multRunning) {
                Main.waiting = false;
                Main.connected = false;
                ipInput.setVisible(false);
                portInput.setVisible(false);
                changeColor.setVisible(false);
                ipInput.setEnabled(false);
                portInput.setEnabled(true);

                if (Main.isServer) {
                    Server.close();
                } else {
                    Client.close();
                }
                Main.multRunning = false;
            }
        });

        jf.setJMenuBar(bar);
        bar.add(menu);
        bar.add(mult);

        menu.add(item);
        mult.add(multActItem);
        mult.add(clientItem);
        mult.add(serverItem);
        mult.add(beenden);

        JButton next, prev;

        next = new JButton(">");
        next.setBounds(85, 295, 35, 20);
        next.setFocusPainted(false);
        next.setBackground(new Color(233, 203, 168));
        next.setBorder(BorderFactory.createLineBorder(Color.BLACK));
        next.addActionListener(e -> {

            if (Main.multRunning) {
                if (Main.isServer) {
                    if (Board.serverWhite) {
                        if(Board.turnWhite){
                            umwandelnWN();
                            Server.send(Board.umwandelnW.getClass().getSimpleName());
                        }
                    }else{
                        if(!Board.turnWhite){
                            umwandelnBN();
                            Server.send(Board.umwandelnB.getClass().getSimpleName());
                        }
                    }
                }else{
                    if (Board.serverWhite) {
                        if(!Board.turnWhite){
                            umwandelnBN();
                            Client.send(Board.umwandelnB.getClass().getSimpleName());
                        }
                    }else{
                        if(Board.turnWhite){
                            umwandelnWN();
                            Client.send(Board.umwandelnW.getClass().getSimpleName());
                        }
                    }
                }
            }else{
                if (Board.turnWhite) {
                    umwandelnWN();

                } else {
                    umwandelnBN();
                }
            }


        });
        next.setVisible(true);

        prev = new JButton("<");
        prev.setBounds(30, 295, 35, 20);
        prev.setFocusPainted(false);
        prev.setBackground(new Color(233, 203, 168));
        prev.setBorder(BorderFactory.createLineBorder(Color.BLACK));
        prev.addActionListener(e -> {
            if (Main.multRunning) {
                if (Main.isServer) {
                    if (Board.serverWhite) {
                        if(Board.turnWhite){
                            umwandelnWP();
                            Server.send(Board.umwandelnW.getClass().getSimpleName());
                        }
                    }else{
                        if(!Board.turnWhite){
                            umwandelnBP();
                            Server.send(Board.umwandelnB.getClass().getSimpleName());
                        }
                    }
                }else{
                    if (Board.serverWhite) {
                        if(!Board.turnWhite){
                            umwandelnBP();
                            Client.send(Board.umwandelnB.getClass().getSimpleName());
                        }
                    }else{
                        if(Board.turnWhite){
                            umwandelnWP();
                            Client.send(Board.umwandelnW.getClass().getSimpleName());
                        }
                    }
                }
            }else{
                if (Board.turnWhite) {
                    umwandelnWP();

                } else {
                    umwandelnBP();
                }
            }
        });
        prev.setVisible(true);


        draw = new Draw();
        draw.setBounds(0, 0, width, height);
        draw.setVisible(true);
        draw.addMouseListener(new MouseHandler());
        draw.addMouseMotionListener(new MouseMotionHandler());
        draw.add(next);
        draw.add(prev);
        draw.add(ipInput);
        draw.add(portInput);
        draw.add(changeColor);
        jf.add(draw);


        jf.setVisible(true);
    }

    public void umwandelnWN() {
        if (Board.umwandelnW instanceof Dame) {
            Board.umwandelnW = new Laeufer(true, IL.figurenW[2]);
        } else if (Board.umwandelnW instanceof Turm) {
            Board.umwandelnW = new Dame(true, IL.figurenW[1]);
        } else if (Board.umwandelnW instanceof Springer) {
            Board.umwandelnW = new Turm(true, IL.figurenW[4]);
        } else if (Board.umwandelnW instanceof Laeufer) {
            Board.umwandelnW = new Springer(true, IL.figurenW[3]);
        }
    }

    public void umwandelnWP() {
        if (Board.umwandelnW instanceof Dame) {
            Board.umwandelnW = new Turm(true, IL.figurenW[4]);
        } else if (Board.umwandelnW instanceof Turm) {
            Board.umwandelnW = new Springer(true, IL.figurenW[3]);
        } else if (Board.umwandelnW instanceof Springer) {
            Board.umwandelnW = new Laeufer(true, IL.figurenW[2]);
        } else if (Board.umwandelnW instanceof Laeufer) {
            Board.umwandelnW = new Dame(true, IL.figurenW[1]);
        }
    }

    public void umwandelnBN() {
        if (Board.umwandelnB instanceof Dame) {
            Board.umwandelnB = new Laeufer(false, IL.figurenB[2]);
        } else if (Board.umwandelnB instanceof Turm) {
            Board.umwandelnB = new Dame(false, IL.figurenB[1]);
        } else if (Board.umwandelnB instanceof Springer) {
            Board.umwandelnB = new Turm(false, IL.figurenB[4]);
        } else if (Board.umwandelnB instanceof Laeufer) {
            Board.umwandelnB = new Springer(false, IL.figurenB[3]);
        }
    }

    public void umwandelnBP() {
        if (Board.umwandelnB instanceof Dame) {
            Board.umwandelnB = new Turm(false, IL.figurenB[4]);
        } else if (Board.umwandelnB instanceof Turm) {
            Board.umwandelnB = new Springer(false, IL.figurenB[3]);
        } else if (Board.umwandelnB instanceof Springer) {
            Board.umwandelnB = new Laeufer(false, IL.figurenB[2]);
        } else if (Board.umwandelnB instanceof Laeufer) {
            Board.umwandelnB = new Dame(false, IL.figurenB[1]);
        }
    }
}
